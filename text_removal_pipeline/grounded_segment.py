#!/usr/bin/env python3
"""
grounded_segment.py — Text-guided segmentation using GroundingDINO + SAM.

For each image in images_dir:
  1. GroundingDINO detects bounding boxes matching the text query.
  2. SAM (SamPredictor) segments within those boxes → binary mask.
  3. All per-box masks are unioned and saved as a PNG to masks_dir.

Only images with at least one detection are saved (skips no-match frames).
"""

import os
import sys
import warnings
from pathlib import Path

import cv2
import numpy as np
import torch
from tqdm import tqdm

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────

_PIPELINE_DIR = Path(__file__).parent
_WEIGHTS_DIR  = _PIPELINE_DIR / "weights"

GDINO_CONFIG_URL  = (
    "https://raw.githubusercontent.com/IDEA-Research/GroundingDINO/"
    "main/groundingdino/config/GroundingDINO_SwinT_OGC.py"
)
GDINO_WEIGHTS_URL = (
    "https://github.com/IDEA-Research/GroundingDINO/releases/download/"
    "v0.1.0-alpha/groundingdino_swint_ogc.pth"
)

GDINO_CONFIG  = _WEIGHTS_DIR / "GroundingDINO_SwinT_OGC.py"
GDINO_WEIGHTS = _WEIGHTS_DIR / "groundingdino_swint_ogc.pth"


# ─── Weight download ──────────────────────────────────────────────────────────

def _download(url: str, dest: Path):
    """Download a file with a progress bar."""
    import urllib.request
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"[grounded_segment] Downloading {dest.name} …")
    def _hook(count, block, total):
        pct = min(count * block / total * 100, 100) if total > 0 else 0
        print(f"\r  {pct:.1f}%", end="", flush=True)
    urllib.request.urlretrieve(url, str(dest), _hook)
    print()


def ensure_weights():
    """Download GroundingDINO config + weights if not present."""
    if not GDINO_CONFIG.exists():
        _download(GDINO_CONFIG_URL, GDINO_CONFIG)
    if not GDINO_WEIGHTS.exists():
        _download(GDINO_WEIGHTS_URL, GDINO_WEIGHTS)


# ─── Model loading ────────────────────────────────────────────────────────────

def load_gdino(device: str):
    """Load GroundingDINO model."""
    try:
        from groundingdino.util.inference import load_model
    except ImportError:
        print("[grounded_segment] ERROR: groundingdino not installed.")
        print("  Run: pip install groundingdino-py")
        sys.exit(1)
    ensure_weights()
    print(f"[grounded_segment] Loading GroundingDINO on {device} …")
    model = load_model(str(GDINO_CONFIG), str(GDINO_WEIGHTS), device=device)
    model.eval()
    return model


def load_sam(sam_checkpoint: str, device: str):
    """Load SAM predictor."""
    from segment_anything import sam_model_registry, SamPredictor
    print(f"[grounded_segment] Loading SAM ViT-B on {device} …")
    sam = sam_model_registry["vit_b"](checkpoint=sam_checkpoint)
    sam.to(device=device)
    return SamPredictor(sam)


# ─── Per-image segmentation ───────────────────────────────────────────────────

def segment_image(
    image_path: str,
    gdino_model,
    sam_predictor,
    text_query: str,
    box_threshold: float,
    text_threshold: float,
    device: str,
) -> np.ndarray | None:
    """
    Run GroundingDINO + SAM on one image.

    Returns:
        Binary uint8 mask (H×W, 255=object 0=background), or None if no detection.
    """
    from groundingdino.util.inference import load_image, predict

    # Load image for GroundingDINO (returns PIL-sourced tensors)
    image_source, image_tensor = load_image(image_path)  # image_source: np.ndarray H×W×3 RGB
    H, W = image_source.shape[:2]

    # GroundingDINO detection
    with torch.no_grad():
        boxes_norm, logits, phrases = predict(
            model=gdino_model,
            image=image_tensor,
            caption=text_query,
            box_threshold=box_threshold,
            text_threshold=text_threshold,
            device=device,
        )

    if boxes_norm is None or len(boxes_norm) == 0:
        return None

    # Convert normalized cxcywh → pixel xyxy
    boxes_px = _cxcywh_to_xyxy(boxes_norm, W, H)

    # SAM segmentation with detected boxes
    sam_predictor.set_image(image_source)
    combined_mask = np.zeros((H, W), dtype=np.uint8)

    for box in boxes_px:
        masks, scores, _ = sam_predictor.predict(
            box=box,
            multimask_output=True,
        )
        # Pick highest-score mask
        best = masks[np.argmax(scores)]
        combined_mask = np.maximum(combined_mask, (best * 255).astype(np.uint8))

    return combined_mask if combined_mask.any() else None


def _cxcywh_to_xyxy(boxes_norm: torch.Tensor, W: int, H: int) -> np.ndarray:
    """Convert normalized cxcywh to pixel xyxy."""
    boxes = boxes_norm.cpu().numpy().copy()
    cx, cy, w, h = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    x1 = np.clip((cx - w / 2) * W, 0, W)
    y1 = np.clip((cy - h / 2) * H, 0, H)
    x2 = np.clip((cx + w / 2) * W, 0, W)
    y2 = np.clip((cy + h / 2) * H, 0, H)
    return np.stack([x1, y1, x2, y2], axis=1).astype(np.float32)


# ─── Main: batch segmentation ─────────────────────────────────────────────────

def run_segmentation(
    images_dir: str,
    masks_dir: str,
    text_query: str,
    sam_checkpoint: str,
    box_threshold: float = 0.30,
    text_threshold: float = 0.25,
    device: str | None = None,
    max_images: int | None = None,
) -> int:
    """
    Segment all images in images_dir matching text_query.
    Saves masks to masks_dir/{image_stem}.png.

    Returns:
        Number of images that produced a mask.
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    images_dir = Path(images_dir)
    masks_dir  = Path(masks_dir)
    masks_dir.mkdir(parents=True, exist_ok=True)

    # Collect image paths
    image_paths = sorted([
        p for p in images_dir.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".PNG", ".JPG"}
    ])
    if max_images:
        image_paths = image_paths[:max_images]

    print(f"\n[grounded_segment] Query       : '{text_query}'")
    print(f"[grounded_segment] Images      : {len(image_paths)}")
    print(f"[grounded_segment] Box thresh  : {box_threshold}")
    print(f"[grounded_segment] Text thresh : {text_threshold}")
    print(f"[grounded_segment] Device      : {device}")
    print(f"[grounded_segment] Masks → {masks_dir}\n")

    # Load models
    gdino    = load_gdino(device)
    sam_pred = load_sam(sam_checkpoint, device)

    n_saved = 0
    n_skip  = 0

    for img_path in tqdm(image_paths, desc="Segmenting", unit="img"):
        try:
            mask = segment_image(
                str(img_path), gdino, sam_pred,
                text_query, box_threshold, text_threshold, device,
            )
        except Exception as e:
            tqdm.write(f"  [WARN] {img_path.name}: {e}")
            n_skip += 1
            continue

        if mask is None:
            n_skip += 1
            continue

        out_path = masks_dir / f"{img_path.stem}.png"
        cv2.imwrite(str(out_path), mask)
        n_saved += 1

    print(f"\n[grounded_segment] Done.")
    print(f"  Masks saved : {n_saved}")
    print(f"  Skipped     : {n_skip} (no detection or error)")
    return n_saved


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Text-guided GroundingDINO+SAM segmentation")
    parser.add_argument("--images",         required=True,  help="Directory of input images")
    parser.add_argument("--masks",          required=True,  help="Directory to save masks")
    parser.add_argument("--query",          required=True,  help="Grounding text query")
    parser.add_argument("--sam_checkpoint", required=True,  help="Path to SAM .pth checkpoint")
    parser.add_argument("--box_threshold",  type=float, default=0.30)
    parser.add_argument("--text_threshold", type=float, default=0.25)
    parser.add_argument("--device",         default=None)
    parser.add_argument("--max_images",     type=int, default=None,
                        help="Process only first N images (for testing)")
    args = parser.parse_args()

    run_segmentation(
        images_dir=args.images,
        masks_dir=args.masks,
        text_query=args.query,
        sam_checkpoint=args.sam_checkpoint,
        box_threshold=args.box_threshold,
        text_threshold=args.text_threshold,
        device=args.device,
        max_images=args.max_images,
    )
