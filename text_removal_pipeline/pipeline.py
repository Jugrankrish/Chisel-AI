#!/usr/bin/env python3
"""
pipeline.py — Text-guided 3D Gaussian removal pipeline.

Full end-to-end workflow:
  1. Refine user text → GroundingDINO query  (llm_refine.py)
  2. Generate cameras.json from COLMAP        (colmap_utils.py)
  3. GroundingDINO + SAM: detect & segment    (grounded_segment.py)
  4. Remove matched Gaussians from PLY        (remove_gaussians.py)
  5. Save cleaned PLY to outputs/

Usage:
  python text_removal_pipeline/pipeline.py \\
      --text "remove the truck" \\
      --ply  exports/FO_dataset/truck/point_cloud/iteration_30000/point_cloud.ply \\
      --images     data/tandt/truck/images/ \\
      --colmap_dir data/tandt/truck/sparse/0/ \\
      [--output  text_removal_pipeline/outputs/cleaned.ply] \\
      [--llm     none] \\
      [--box_threshold 0.30] \\
      [--text_threshold 0.25] \\
      [--max_images N]         # quick test with only N images
"""

import argparse
import sys
import time
from pathlib import Path

# ── Make sure the repo root is on sys.path so sibling imports work ────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_PIPELINE_DIR = Path(__file__).resolve().parent

# Default paths (relative to repo root)
_DEFAULT_PLY     = _REPO_ROOT / "exports/FO_dataset/truck/point_cloud/iteration_30000/point_cloud.ply"
_DEFAULT_IMAGES  = _REPO_ROOT / "data/tandt/truck/images"
_DEFAULT_COLMAP  = _REPO_ROOT / "data/tandt/truck/sparse/0"
_DEFAULT_SAM     = _REPO_ROOT / "sam_vit_b_01ec64.pth"
_DEFAULT_MASKS   = _PIPELINE_DIR / "masks"
_DEFAULT_OUTPUT  = _PIPELINE_DIR / "outputs" / "cleaned.ply"


def main():
    parser = argparse.ArgumentParser(
        description="Text-guided 3D Gaussian removal pipeline",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # ── Required ──
    parser.add_argument("--text",  required=True,
                        help='Object to remove, e.g. "remove the truck"')

    # ── Data paths ──
    parser.add_argument("--ply",        default=str(_DEFAULT_PLY),
                        help="Input 3DGS .ply file")
    parser.add_argument("--images",     default=str(_DEFAULT_IMAGES),
                        help="Directory of training images")
    parser.add_argument("--colmap_dir", default=str(_DEFAULT_COLMAP),
                        help="COLMAP sparse/0 directory (cameras.bin, images.bin, points3D.bin)")
    parser.add_argument("--sam",        default=str(_DEFAULT_SAM),
                        help="SAM ViT-B checkpoint path")

    # ── Output paths ──
    parser.add_argument("--masks",  default=str(_DEFAULT_MASKS),
                        help="Directory to save per-image segmentation masks")
    parser.add_argument("--output", default=str(_DEFAULT_OUTPUT),
                        help="Output cleaned .ply path")

    # ── LLM backend ──
    parser.add_argument("--llm",
                        choices=["agent", "ollama", "none", "bedrock", "gemini", "openai"],
                        default="agent",
                        help=("LLM backend for prompt refinement (default: agent). "
                              "'agent' uses llm_agent.py (OpenAI→OpenRouter→Gemini→Mock chain). "
                              "'ollama' runs locally, no API key needed. "
                              "'none' uses regex-strip (instant offline fallback)."))

    # ── GroundingDINO thresholds ──
    parser.add_argument("--box_threshold",  type=float, default=0.30,
                        help="GroundingDINO box confidence threshold")
    parser.add_argument("--text_threshold", type=float, default=0.25,
                        help="GroundingDINO text confidence threshold")

    # ── 3D Removal thresholds ──
    parser.add_argument("--ratio",          type=float, default=0.50,
                        help="Visual hull ratio threshold for 3D removal (default: 0.50)")

    # ── Misc ──
    parser.add_argument("--max_images", type=int, default=None,
                        help="Process only first N images (useful for quick tests)")
    parser.add_argument("--workers", type=int, default=None,
                        help="Parallel workers for Gaussian projection (None = all CPUs)")
    parser.add_argument("--force_cameras", action="store_true",
                        help="Re-generate cameras.json even if cached")
    parser.add_argument("--skip_segmentation", action="store_true",
                        help="Skip segmentation step (use existing masks in --masks dir)")

    args = parser.parse_args()

    # ─────────────────────────────────────────────────────────────────────────
    print("\n" + "═" * 65)
    print("  TEXT-GUIDED 3D GAUSSIAN REMOVAL PIPELINE")
    print("═" * 65)
    print(f"  Text prompt  : {args.text}")
    print(f"  LLM backend  : {args.llm}")
    print(f"  PLY input    : {args.ply}")
    print(f"  Images       : {args.images}")
    print(f"  COLMAP dir   : {args.colmap_dir}")
    print(f"  Masks dir    : {args.masks}")
    print(f"  Output PLY   : {args.output}")
    print("═" * 65 + "\n")

    t0 = time.time()

    # ── Validate inputs ───────────────────────────────────────────────────────
    _check(args.ply,        "PLY file")
    _check(args.images,     "Images directory")
    _check(args.colmap_dir, "COLMAP directory")
    _check(args.sam,        "SAM checkpoint")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Refine text → grounding query
    # ─────────────────────────────────────────────────────────────────────────
    print("─" * 65)
    print("STEP 1 / 4  —  Refine text prompt")
    print("─" * 65)
    from text_removal_pipeline.llm_refine import refine_prompt
    query = refine_prompt(args.text, backend=args.llm)
    print(f"  Grounding query: '{query}'\n")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Generate cameras.json
    # ─────────────────────────────────────────────────────────────────────────
    print("─" * 65)
    print("STEP 2 / 4  —  Generate cameras.json (from COLMAP)")
    print("─" * 65)
    from text_removal_pipeline.colmap_utils import get_cameras_json
    cameras_json = get_cameras_json(args.colmap_dir, force=args.force_cameras)
    print()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Segment images
    # ─────────────────────────────────────────────────────────────────────────
    print("─" * 65)
    print("STEP 3 / 4  —  GroundingDINO + SAM segmentation")
    print("─" * 65)
    if args.skip_segmentation:
        print("  [SKIPPED] Using existing masks in:", args.masks)
    else:
        from text_removal_pipeline.grounded_segment import run_segmentation
        n_masks = run_segmentation(
            images_dir=args.images,
            masks_dir=args.masks,
            text_query=query,
            sam_checkpoint=args.sam,
            box_threshold=args.box_threshold,
            text_threshold=args.text_threshold,
            max_images=args.max_images,
        )
        if n_masks == 0:
            print("\n  ⚠ WARNING: No masks generated.")
            print("  Possible causes:")
            print("    - Query too specific? Try lowering --box_threshold (e.g. 0.20)")
            print("    - Object not visible in images?")
            print("    - GroundingDINO not detecting the object.")
            print("  Aborting — no Gaussians removed.")
            sys.exit(1)
    print()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: Remove Gaussians
    # ─────────────────────────────────────────────────────────────────────────
    print("─" * 65)
    print("STEP 4 / 4  —  Remove Gaussians (blacklist projection)")
    print("─" * 65)
    from text_removal_pipeline.remove_gaussians import remove_gaussians
    stats = remove_gaussians(
        ply_path=args.ply,
        cameras_path=cameras_json,
        masks_dir=args.masks,
        output_path=args.output,
        num_workers=args.workers,
        ratio=args.ratio,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # Summary
    # ─────────────────────────────────────────────────────────────────────────
    elapsed = time.time() - t0
    print("\n" + "═" * 65)
    print("  PIPELINE COMPLETE")
    print("═" * 65)
    print(f"  Text prompt    : {args.text}")
    print(f"  Grounding query: {query}")
    print(f"  Total Gaussians: {stats['total']:,}")
    print(f"  Removed        : {stats['removed']:,}  ({100*stats['removed']/max(stats['total'],1):.1f}%)")
    print(f"  Kept           : {stats['kept']:,}  ({100*stats['kept']/max(stats['total'],1):.1f}%)")
    print(f"  Output PLY     : {args.output}")
    print(f"  Total time     : {elapsed:.1f}s")
    print("═" * 65 + "\n")


def _check(path: str, label: str):
    from pathlib import Path
    if not Path(path).exists():
        print(f"  ERROR: {label} not found: {path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
