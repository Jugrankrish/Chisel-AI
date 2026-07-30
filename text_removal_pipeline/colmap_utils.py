#!/usr/bin/env python3
"""
colmap_utils.py — Convert COLMAP sparse reconstruction to cameras.json.

Wraps the logic from scripts/colmap_to_json.py with caching so it only
runs once per colmap_dir, writing the result to cache/cameras.json.
"""

import json
import sys
import numpy as np
from pathlib import Path


# ─── Cache path ───────────────────────────────────────────────────────────────

_PIPELINE_DIR = Path(__file__).parent
_CACHE_PATH   = _PIPELINE_DIR / "cache" / "cameras.json"


def get_cameras_json(colmap_dir: str, force: bool = False) -> str:
    """
    Return path to cameras.json for the given COLMAP sparse directory.

    If the cache doesn't exist (or force=True), generates it using pycolmap.

    Args:
        colmap_dir: Path to COLMAP sparse/0 directory with .bin files.
        force:      If True, regenerate even if cache exists.

    Returns:
        Absolute path to cameras.json as a string.
    """
    cache_path = _CACHE_PATH
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    if cache_path.exists() and not force:
        print(f"[colmap_utils] Using cached cameras.json: {cache_path}")
        return str(cache_path)

    print(f"[colmap_utils] Generating cameras.json from {colmap_dir}...")
    _convert(colmap_dir, str(cache_path))
    return str(cache_path)


def _convert(colmap_dir: str, output_json: str):
    """
    Core conversion: COLMAP binary → cameras.json.
    Mirror of scripts/colmap_to_json.py — kept here to be self-contained.
    """
    try:
        import pycolmap
    except ImportError:
        print("[colmap_utils] ERROR: pycolmap not installed.")
        print("  Install with: pip install pycolmap")
        sys.exit(1)

    colmap_dir = Path(colmap_dir)
    if not colmap_dir.exists():
        print(f"[colmap_utils] ERROR: COLMAP directory not found: {colmap_dir}")
        sys.exit(1)

    reconstruction = pycolmap.Reconstruction(str(colmap_dir))
    print(f"[colmap_utils]   Found {len(reconstruction.cameras)} camera(s), "
          f"{len(reconstruction.images)} image(s)")

    cameras_json = []
    for image_id, image in reconstruction.images.items():
        camera = reconstruction.cameras[image.camera_id]
        width  = camera.width
        height = camera.height

        # Intrinsics — handle different COLMAP camera models
        model = str(camera.model)
        params = camera.params
        if "PINHOLE" in model and len(params) >= 4:
            fx, fy, cx, cy = params[0], params[1], params[2], params[3]
        elif ("SIMPLE" in model or "RADIAL" in model) and len(params) >= 3:
            fx = fy = params[0]
            cx, cy  = params[1], params[2]
        else:
            fx = params[0] if len(params) > 0 else width / 2
            fy = params[1] if len(params) > 1 else height / 2
            cx = params[2] if len(params) > 2 else width / 2
            cy = params[3] if len(params) > 3 else height / 2

        # Extrinsics: world-to-camera → camera-to-world
        cam_from_world = image.cam_from_world()
        w2c = cam_from_world.matrix()   # 3×4
        R_w2c = w2c[:, :3]
        t_w2c = w2c[:, 3]
        R_c2w = R_w2c.T
        t_c2w = -R_c2w @ t_w2c

        K = np.array([[fx, 0, cx],
                      [0, fy, cy],
                      [0,  0,  1]])

        cameras_json.append({
            "image_name": image.name,
            "width":  int(width),
            "height": int(height),
            "R": R_c2w.tolist(),
            "T": t_c2w.tolist(),
            "K": K.tolist(),
        })

    with open(output_json, "w") as f:
        json.dump(cameras_json, f, indent=2)

    print(f"[colmap_utils] ✓ Saved {len(cameras_json)} cameras → {output_json}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Convert COLMAP sparse to cameras.json")
    parser.add_argument("--colmap_dir", required=True)
    parser.add_argument("--output",     required=True)
    parser.add_argument("--force",      action="store_true")
    args = parser.parse_args()
    _convert(args.colmap_dir, args.output)
