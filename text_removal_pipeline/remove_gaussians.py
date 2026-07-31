#!/usr/bin/env python3
"""
remove_gaussians.py — Blacklist-based Gaussian removal.

The inverse of clean-gs.py's whitelist logic:
  - Any Gaussian that projects onto a MASKED pixel in ANY camera view is REMOVED.
  - Unmasked (background) Gaussians are KEPT.

This lets you specify WHAT TO REMOVE instead of what to keep.
"""

import os
import json
import numpy as np
import cv2
from pathlib import Path
from plyfile import PlyData, PlyElement
from dataclasses import dataclass
from multiprocessing import Pool, cpu_count


# ─── Camera dataclass (mirrors clean-gs.py) ───────────────────────────────────

@dataclass
class Camera:
    image_name: str
    width:      int
    height:     int
    R:          np.ndarray   # 3×3 camera-to-world rotation
    T:          np.ndarray   # 3×1 camera-to-world translation
    K:          np.ndarray   # 3×3 intrinsic matrix


def load_cameras(cameras_path: str) -> list[Camera]:
    with open(cameras_path) as f:
        data = json.load(f)
    return [
        Camera(
            image_name=d["image_name"],
            width=d["width"],
            height=d["height"],
            R=np.array(d["R"]),
            T=np.array(d["T"]),
            K=np.array(d["K"]),
        )
        for d in data
    ]


# ─── Projection ───────────────────────────────────────────────────────────────

def project_point(xyz: np.ndarray, cam: Camera):
    """
    Project a 3D world point into image coordinates.

    Returns:
        (u, v, depth) if visible, else None.
    """
    R_w2c = cam.R.T
    T_w2c = -R_w2c @ cam.T
    xyz_c = R_w2c @ xyz + T_w2c
    depth = xyz_c[2]
    if depth <= 0:
        return None
    uv_h = cam.K @ xyz_c
    u = uv_h[0] / uv_h[2]
    v = uv_h[1] / uv_h[2]
    if 0 <= u < cam.width and 0 <= v < cam.height:
        return int(u), int(v), depth
    return None


# ─── Per-view blacklist worker ────────────────────────────────────────────────

def _process_view_blacklist(args):
    """
    Worker: returns boolean array — True for Gaussians that land on a masked pixel.
    """
    view_idx, cam, masks_dir, xyz = args
    num_gaussians = len(xyz)
    base_name = Path(cam.image_name).stem

    # Find mask file (any extension)
    mask_path = None
    for ext in [".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"]:
        candidate = Path(masks_dir) / f"{base_name}{ext}"
        if candidate.exists():
            mask_path = candidate
            break

    if mask_path is None:
        return None   # No mask for this view → skip

    mask_img = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if mask_img is None:
        return None
    if mask_img.shape[0] != cam.height or mask_img.shape[1] != cam.width:
        mask_img = cv2.resize(mask_img, (cam.width, cam.height),
                              interpolation=cv2.INTER_NEAREST)

    # Binary mask: True = object to remove
    object_mask = mask_img > 127

    mask_hits = np.zeros(num_gaussians, dtype=np.bool_)
    screen_hits = np.zeros(num_gaussians, dtype=np.bool_)
    for g_idx in range(num_gaussians):
        proj = project_point(xyz[g_idx], cam)
        if proj is not None:
            u, v, _ = proj
            screen_hits[g_idx] = True
            if object_mask[v, u]:
                mask_hits[g_idx] = True
    return mask_hits, screen_hits


# ─── Main removal function ────────────────────────────────────────────────────

def remove_gaussians(
    ply_path:     str,
    cameras_path: str,
    masks_dir:    str,
    output_path:  str,
    num_workers:  int | None = None,
    ratio:        float = 0.25,   # lowered from 0.50 — 0.50 is too strict for
                                  # small/occluded objects like tyres/wheels that
                                  # are only visible from ~half the cameras.
) -> dict:
    """
    Remove Gaussians that project onto masked pixels in any camera view.

    Args:
        ply_path:     Input .ply file (3DGS point cloud).
        cameras_path: Path to cameras.json.
        masks_dir:    Directory of per-image binary masks.
        output_path:  Output .ply path.
        num_workers:  Multiprocessing workers (None = all CPUs).

    Returns:
        Dict with stats: total, removed, kept.
    """
    if num_workers is None:
        num_workers = max(1, cpu_count() - 1)

    print("=" * 65)
    print("REMOVE GAUSSIANS (Visual Hull Carving)")
    print("=" * 65)
    print(f"  PLY      : {ply_path}")
    print(f"  Cameras  : {cameras_path}")
    print(f"  Masks    : {masks_dir}")
    print(f"  Output   : {output_path}")
    print(f"  Ratio    : > {ratio:.2f}")
    print(f"  Workers  : {num_workers}")
    print("=" * 65)

    # ── Load PLY ──────────────────────────────────────────────────────────────
    print(f"\n[1/3] Loading Gaussians …")
    plydata = PlyData.read(ply_path)
    vertex  = plydata["vertex"]
    xyz = np.stack([vertex["x"], vertex["y"], vertex["z"]], axis=1)
    total = len(xyz)
    print(f"  Loaded {total:,} Gaussians")

    # ── Load cameras ──────────────────────────────────────────────────────────
    print(f"\n[2/3] Loading cameras …")
    cameras = load_cameras(cameras_path)

    mask_extensions = ["*.png", "*.jpg", "*.jpeg", "*.PNG", "*.JPG", "*.JPEG"]
    mask_files = []
    for ext in mask_extensions:
        mask_files.extend(Path(masks_dir).glob(ext))
    print(f"  {len(cameras)} cameras, {len(mask_files)} mask(s) found")

    if len(mask_files) == 0:
        print("\n  WARNING: No mask files found in masks_dir!")
        print(f"  Expected PNG files in: {masks_dir}")
        return {"total": total, "removed": 0, "kept": total}

    # ── Visual Hull Carving ───────────────────────────────────────────────────
    print(f"\n[3/3] Projecting Gaussians through {len(mask_files)} masked views …")
    args_list = [(idx, cam, masks_dir, xyz) for idx, cam in enumerate(cameras)]

    total_mask_hits = np.zeros(total, dtype=np.int32)
    total_screen_hits = np.zeros(total, dtype=np.int32)

    with Pool(num_workers) as pool:
        for result in pool.imap_unordered(_process_view_blacklist, args_list, chunksize=2):
            if result is not None:
                m_hits, s_hits = result
                total_mask_hits += m_hits.astype(np.int32)
                total_screen_hits += s_hits.astype(np.int32)

    # Calculate multi-view ratio
    valid_mask = total_screen_hits > 0
    calculated_ratio = np.zeros(total, dtype=np.float32)
    calculated_ratio[valid_mask] = total_mask_hits[valid_mask] / total_screen_hits[valid_mask]

    # ── Ratio distribution diagnostic ─────────────────────────────────────────────
    # Shows how many Gaussians fall at each threshold so you can tune --ratio.
    thresholds = [0.10, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60]
    print(f"\n  Ratio distribution (of {np.sum(valid_mask):,} Gaussians visible in ≥1 view):")
    for t in thresholds:
        n = int(np.sum(calculated_ratio[valid_mask] > t))
        marker = "  ← current" if abs(t - ratio) < 0.001 else ""
        print(f"    ratio > {t:.2f}: {n:>8,} Gaussians would be removed{marker}")

    blacklist_mask = calculated_ratio > ratio
    keep_mask = ~blacklist_mask
    n_removed = int(np.sum(blacklist_mask))
    n_kept    = int(np.sum(keep_mask))

    print(f"\n  Results (ratio > {ratio:.2f}):")
    print(f"    Total     : {total:,}")
    print(f"    Removed   : {n_removed:,}  ({100*n_removed/total:.1f}%)")
    print(f"    Kept      : {n_kept:,}  ({100*n_kept/total:.1f}%)")

    # ── Save output PLY ───────────────────────────────────────────────────────
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    vertex_kept = vertex[keep_mask]
    el = PlyElement.describe(vertex_kept, "vertex")
    PlyData([el]).write(output_path)
    file_mb = os.path.getsize(output_path) / (1024 * 1024)

    print(f"\n✓ Saved {n_kept:,} Gaussians to {output_path}  ({file_mb:.1f} MB)")
    print("=" * 65)

    return {"total": total, "removed": n_removed, "kept": n_kept}


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Remove Gaussians via visual hull carving")
    parser.add_argument("--ply",     required=True, help="Input .ply file")
    parser.add_argument("--cameras", required=True, help="cameras.json path")
    parser.add_argument("--masks",   required=True, help="Directory of binary mask PNGs")
    parser.add_argument("--output",  required=True, help="Output .ply path")
    parser.add_argument("--ratio",   type=float, default=0.50, help="Carving ratio (default: 0.50)")
    parser.add_argument("--workers", type=int, default=None)
    args = parser.parse_args()

    remove_gaussians(
        ply_path=args.ply,
        cameras_path=args.cameras,
        masks_dir=args.masks,
        output_path=args.output,
        num_workers=args.workers,
        ratio=args.ratio,
    )
