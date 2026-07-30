"""
chisel_ai/ply_pruner.py
=======================
PLY Point Cloud Pruner – Member 3 (Agent Logic & Pipeline Orchestrator)

Provides a single public function:

    prune_gaussian_splat(input_ply_path, output_ply_path, indices_to_remove)

which deletes the specified vertex indices from a 3D Gaussian Splat PLY file
and writes the pruned result to a new binary PLY file.

Dependencies: plyfile, numpy
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

import numpy as np
from plyfile import PlyData, PlyElement  # type: ignore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Return-value container
# ---------------------------------------------------------------------------
@dataclass
class PruneResult:
    """Metrics returned by :func:`prune_gaussian_splat`."""

    input_ply_path: str
    output_ply_path: str

    original_point_count: int
    pruned_point_count: int          # points remaining after removal
    removed_point_count: int         # points actually deleted

    original_file_size_bytes: int    # size of input file
    output_file_size_bytes: int      # size of written output file
    estimated_bytes_saved: int       # original − output (approximate)

    reduction_percentage: float      # % of points removed
    elapsed_seconds: float           # total wall-clock time for the operation

    def summary(self) -> str:
        lines = [
            "=" * 52,
            "  Chisel AI – Prune Result Summary",
            "=" * 52,
            f"  Input  : {self.input_ply_path}",
            f"  Output : {self.output_ply_path}",
            "-" * 52,
            f"  Original points   : {self.original_point_count:>10,}",
            f"  Points removed    : {self.removed_point_count:>10,}",
            f"  Remaining points  : {self.pruned_point_count:>10,}",
            f"  Reduction         : {self.reduction_percentage:>9.2f} %",
            "-" * 52,
            f"  Input file size   : {self._fmt_bytes(self.original_file_size_bytes):>10}",
            f"  Output file size  : {self._fmt_bytes(self.output_file_size_bytes):>10}",
            f"  Estimated savings : {self._fmt_bytes(self.estimated_bytes_saved):>10}",
            "-" * 52,
            f"  Elapsed           : {self.elapsed_seconds:.3f} s",
            "=" * 52,
        ]
        return "\n".join(lines)

    @staticmethod
    def _fmt_bytes(n: int) -> str:
        for unit in ("B", "KB", "MB", "GB"):
            if abs(n) < 1024:
                return f"{n:.1f} {unit}"
            n /= 1024  # type: ignore[assignment]
        return f"{n:.1f} TB"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _load_ply(path: str) -> PlyData:
    """Load a PLY file and return the PlyData object."""
    logger.info("Loading PLY file: %s", path)
    ply_data = PlyData.read(path)
    vertex_count = len(ply_data["vertex"].data)
    logger.info("  Loaded %d vertices across %d element(s).", vertex_count, len(ply_data.elements))
    return ply_data


def _validate_indices(indices_to_remove: np.ndarray, total_points: int) -> np.ndarray:
    """
    Validate and deduplicate removal indices.

    Parameters
    ----------
    indices_to_remove:
        1-D integer array of vertex indices to delete.
    total_points:
        Total number of vertices in the original PLY.

    Returns
    -------
    np.ndarray
        Sorted, deduplicated, in-bounds integer indices.

    Raises
    ------
    ValueError
        If *indices_to_remove* is empty or all indices are out of range.
    TypeError
        If *indices_to_remove* is not array-like.
    """
    arr = np.asarray(indices_to_remove, dtype=np.int64).ravel()

    if arr.size == 0:
        raise ValueError("indices_to_remove must not be empty.")

    # Deduplicate and sort
    arr = np.unique(arr)

    # Bounds check
    out_of_bounds = arr[(arr < 0) | (arr >= total_points)]
    if out_of_bounds.size > 0:
        logger.warning(
            "%d index/indices are out of range [0, %d) and will be skipped: %s",
            out_of_bounds.size,
            total_points,
            out_of_bounds[:10],  # show first 10 only
        )
        arr = arr[(arr >= 0) & (arr < total_points)]

    if arr.size == 0:
        raise ValueError(
            "All provided indices are out of range – nothing to remove."
        )

    return arr


def _build_keep_mask(total_points: int, indices_to_remove: np.ndarray) -> np.ndarray:
    """Return a boolean mask of shape (total_points,) where True = keep."""
    mask = np.ones(total_points, dtype=bool)
    mask[indices_to_remove] = False
    return mask


def _apply_mask_to_vertex_element(
    vertex_element: PlyElement,
    keep_mask: np.ndarray,
) -> PlyElement:
    """
    Filter the vertex structured array using *keep_mask* and return a new
    :class:`PlyElement` containing only the surviving rows.
    """
    data = vertex_element.data
    filtered = data[keep_mask]
    logger.debug(
        "  Vertex element filtered: %d → %d rows.",
        len(data),
        len(filtered),
    )
    return PlyElement.describe(filtered, "vertex")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def prune_gaussian_splat(
    input_ply_path: str,
    output_ply_path: str,
    indices_to_remove: "np.ndarray | list[int]",
) -> PruneResult:
    """
    Remove vertex indices from a 3D Gaussian Splat PLY file and write the
    pruned result to disk.

    Parameters
    ----------
    input_ply_path:
        Path to the source ``.ply`` file.
    output_ply_path:
        Path where the pruned ``.ply`` file will be written.
        Parent directories will be created automatically.
    indices_to_remove:
        1-D array (or list) of integer vertex indices to delete.
        Duplicates are ignored; out-of-range values trigger a warning and
        are skipped.

    Returns
    -------
    PruneResult
        Dataclass containing counts, file sizes, reduction %, and elapsed time.

    Raises
    ------
    FileNotFoundError
        If *input_ply_path* does not exist.
    ValueError
        If *indices_to_remove* is empty or all entries are out of range.
    """
    t0 = time.perf_counter()

    # ── Validate input path ──────────────────────────────────────────────
    if not os.path.isfile(input_ply_path):
        raise FileNotFoundError(f"Input PLY not found: {input_ply_path!r}")

    original_file_size = os.path.getsize(input_ply_path)
    logger.info("Input file size: %d bytes", original_file_size)

    # ── Load PLY ─────────────────────────────────────────────────────────
    ply_data = _load_ply(input_ply_path)
    vertex_element = ply_data["vertex"]
    original_count = len(vertex_element.data)
    logger.info("Original vertex count: %d", original_count)

    # ── Validate indices ─────────────────────────────────────────────────
    idx = _validate_indices(np.asarray(indices_to_remove, dtype=np.int64), original_count)
    removed_count = idx.size
    logger.info("Indices to remove: %d (%.2f %% of total)", removed_count, 100.0 * removed_count / original_count)

    # ── Build keep mask ───────────────────────────────────────────────────
    keep_mask = _build_keep_mask(original_count, idx)

    # ── Filter vertex element ─────────────────────────────────────────────
    new_vertex_element = _apply_mask_to_vertex_element(vertex_element, keep_mask)
    pruned_count = len(new_vertex_element.data)

    # ── Rebuild PLY elements list (preserve non-vertex elements if any) ───
    new_elements: list[PlyElement] = [new_vertex_element]
    for elem in ply_data.elements:
        if elem.name != "vertex":
            logger.debug("Preserving non-vertex element: %r", elem.name)
            new_elements.append(elem)

    # ── Write output ──────────────────────────────────────────────────────
    out_dir = os.path.dirname(output_ply_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    new_ply = PlyData(new_elements, text=False)  # binary output
    new_ply.write(output_ply_path)
    output_file_size = os.path.getsize(output_ply_path)
    logger.info("Output PLY written: %s (%d bytes)", output_ply_path, output_file_size)

    elapsed = time.perf_counter() - t0
    reduction_pct = 100.0 * removed_count / original_count if original_count > 0 else 0.0

    result = PruneResult(
        input_ply_path=input_ply_path,
        output_ply_path=output_ply_path,
        original_point_count=original_count,
        pruned_point_count=pruned_count,
        removed_point_count=removed_count,
        original_file_size_bytes=original_file_size,
        output_file_size_bytes=output_file_size,
        estimated_bytes_saved=max(0, original_file_size - output_file_size),
        reduction_percentage=reduction_pct,
        elapsed_seconds=elapsed,
    )

    logger.info("Prune complete.\n%s", result.summary())
    return result


# ---------------------------------------------------------------------------
# Quick smoke test (generates a tiny synthetic PLY for self-contained testing)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import tempfile
    import struct

    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s | %(name)s | %(message)s")

    # Build a tiny synthetic PLY with 1000 float32 vertices
    N = 1000

    def _make_synthetic_ply(path: str, n: int) -> None:
        """Write a minimal binary PLY with n xyz vertices."""
        vertices = np.random.rand(n, 3).astype(np.float32)
        dt = np.dtype([("x", "f4"), ("y", "f4"), ("z", "f4")])
        arr = np.empty(n, dtype=dt)
        arr["x"], arr["y"], arr["z"] = vertices[:, 0], vertices[:, 1], vertices[:, 2]
        elem = PlyElement.describe(arr, "vertex")
        PlyData([elem], text=False).write(path)

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "test_input.ply")
        dst = os.path.join(tmp, "test_output.ply")

        _make_synthetic_ply(src, N)
        print(f"\nSynthetic PLY created: {src} ({os.path.getsize(src)} bytes, {N} vertices)")

        # Remove first 150 points (~15%)
        to_remove = np.arange(150)
        result = prune_gaussian_splat(src, dst, to_remove)

        print(result.summary())
        assert result.pruned_point_count == N - 150, "Point count mismatch!"
        assert result.removed_point_count == 150
        print("\n✓ Smoke test passed.")
