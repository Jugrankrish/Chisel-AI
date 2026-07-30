"""
chisel_ai/main_orchestrator.py
==============================
Main Pipeline Orchestrator – Member 3 (Agent Logic & Pipeline Orchestrator)

CLI entry point that ties together:
  - Member 3's LLM Intent Parser (llm_agent.py)
  - Member 3's PLY Pruner        (ply_pruner.py)
  - Member 2's object-index resolver (member2_resolver.py) [optional]

Usage
-----
    python main_orchestrator.py \\
        --prompt "Remove the barber chair" \\
        --input  scene.ply \\
        --output scene_pruned.ply

    # Force mock-mode (skip Member 2 resolver, random 15% slice):
    python main_orchestrator.py \\
        --prompt "Remove the barber chair" \\
        --input  scene.ply \\
        --output scene_pruned.ply \\
        --mock

    # Run built-in end-to-end self-test (no real PLY file needed):
    python main_orchestrator.py --self-test
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from typing import Optional

import numpy as np

# ── Local imports ──────────────────────────────────────────────────────────
# Allow running from repo root or from inside the package directory
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from llm_agent import parse_user_intent
from ply_pruner import PruneResult, prune_gaussian_splat

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Member 2 resolver interface (optional, loaded at runtime)
# ---------------------------------------------------------------------------
def _try_import_member2() -> Optional[object]:
    """
    Attempt to import Member 2's object-index resolver module.

    Expected interface:
        member2_resolver.get_object_indices(ply_path: str, target: str) -> np.ndarray

    Returns the module if it is importable, else None.
    """
    try:
        import importlib
        mod = importlib.import_module("member2_resolver")
        if not hasattr(mod, "get_object_indices"):
            logger.warning(
                "member2_resolver is importable but missing 'get_object_indices' – "
                "falling back to mock."
            )
            return None
        logger.info("Member 2 resolver loaded successfully.")
        return mod
    except ModuleNotFoundError:
        logger.info("member2_resolver not found – will use mock index selection.")
        return None


def _get_member2_indices(ply_path: str, target: str) -> Optional[np.ndarray]:
    """
    Delegate to Member 2 to get the vertex indices of *target* in *ply_path*.
    Returns None if Member 2 is unavailable or raises an error.
    """
    mod = _try_import_member2()
    if mod is None:
        return None
    try:
        indices = mod.get_object_indices(ply_path, target)  # type: ignore[attr-defined]
        arr = np.asarray(indices, dtype=np.int64).ravel()
        logger.info("Member 2 returned %d indices for target %r.", arr.size, target)
        return arr
    except Exception as exc:  # noqa: BLE001
        logger.warning("Member 2 resolver raised an error: %s – falling back to mock.", exc)
        return None


# ---------------------------------------------------------------------------
# Mock index selector (15% random sample for integration testing)
# ---------------------------------------------------------------------------
def _mock_select_indices(ply_path: str, target: str, fraction: float = 0.15) -> np.ndarray:
    """
    Select a random *fraction* of total vertices as a stand-in for
    "the object indices identified by Member 2".

    Seeded by the target string so results are reproducible for the same target.
    """
    from plyfile import PlyData  # type: ignore

    logger.info(
        "[Mock] Loading PLY to determine total vertex count: %s", ply_path
    )
    ply_data = PlyData.read(ply_path)
    total = len(ply_data["vertex"].data)

    n_remove = max(1, int(total * fraction))
    # Seed from target name for reproducibility
    rng = np.random.default_rng(seed=hash(target) % (2**32))
    indices = rng.choice(total, size=n_remove, replace=False)
    indices.sort()

    logger.info(
        "[Mock] Target=%r | Total=%d | Selecting %d indices (%.0f%%) at random.",
        target,
        total,
        n_remove,
        100.0 * fraction,
    )
    return indices


# ---------------------------------------------------------------------------
# Core pipeline function
# ---------------------------------------------------------------------------
def run_pipeline(
    user_prompt: str,
    input_ply: str,
    output_ply: str,
    *,
    force_mock: bool = False,
    mock_fraction: float = 0.15,
) -> PruneResult:
    """
    Execute the full Chisel AI pipeline for a single removal command.

    Steps
    -----
    1. Parse *user_prompt* → intent JSON  (llm_agent)
    2. Resolve object → vertex indices    (member2_resolver OR mock)
    3. Prune PLY file                     (ply_pruner)
    4. Log and return metrics

    Parameters
    ----------
    user_prompt:
        Free-text removal instruction from the user.
    input_ply:
        Path to the input 3D Gaussian Splat PLY file.
    output_ply:
        Path where the pruned PLY will be written.
    force_mock:
        If True, skip Member 2 resolver and use random index selection.
    mock_fraction:
        Fraction of total points to remove in mock mode (default 0.15 = 15%).

    Returns
    -------
    PruneResult
        Metrics from the pruning step.

    Raises
    ------
    FileNotFoundError
        If *input_ply* does not exist.
    ValueError
        If intent parsing returns a non-removal action, or index resolution
        yields no valid indices.
    RuntimeError
        If the pipeline fails for any other reason.
    """
    pipeline_start = time.perf_counter()
    logger.info("=" * 60)
    logger.info("Chisel AI Pipeline – START")
    logger.info("  Prompt    : %r", user_prompt)
    logger.info("  Input PLY : %s", input_ply)
    logger.info("  Output PLY: %s", output_ply)
    logger.info("  Mock mode : %s", force_mock)
    logger.info("=" * 60)

    # ── Step 1: Input validation ──────────────────────────────────────────
    if not os.path.isfile(input_ply):
        raise FileNotFoundError(f"Input PLY file not found: {input_ply!r}")

    # ── Step 2: LLM intent parsing ────────────────────────────────────────
    logger.info("[Step 1/3] Parsing user intent...")
    intent = parse_user_intent(user_prompt)
    logger.info("  Intent: %s", intent)

    action = intent.get("action", "remove")
    target = intent.get("target", "unknown")

    if action != "remove":
        raise ValueError(
            f"Pipeline only supports 'remove' actions, but LLM returned action={action!r}."
        )
    if target == "unknown":
        logger.warning(
            "LLM could not identify a target object. "
            "Will proceed with mock index selection."
        )

    # ── Step 3: Object index resolution ──────────────────────────────────
    logger.info("[Step 2/3] Resolving object indices for target=%r ...", target)

    indices: Optional[np.ndarray] = None
    if not force_mock:
        indices = _get_member2_indices(input_ply, target)

    if indices is None:
        logger.info("  Using mock index selection (%.0f%% random sample).", mock_fraction * 100)
        indices = _mock_select_indices(input_ply, target, fraction=mock_fraction)

    logger.info("  %d indices selected for removal.", indices.size)

    # ── Step 4: PLY pruning ───────────────────────────────────────────────
    logger.info("[Step 3/3] Pruning PLY file...")
    result = prune_gaussian_splat(input_ply, output_ply, indices)

    pipeline_elapsed = time.perf_counter() - pipeline_start
    logger.info(
        "Pipeline complete in %.3f s (pruner: %.3f s).",
        pipeline_elapsed,
        result.elapsed_seconds,
    )

    print(result.summary())
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="chisel_ai",
        description=(
            "Chisel AI – Semantic Scene Pruner\n"
            "Remove objects from a 3D Gaussian Splat PLY file using natural language."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main_orchestrator.py \\
      --prompt "Remove the barber chair" \\
      --input  scene.ply \\
      --output scene_pruned.ply

  # Mock mode (no Member 2 resolver needed):
  python main_orchestrator.py \\
      --prompt "Delete the lamp" \\
      --input  scene.ply \\
      --output scene_pruned.ply \\
      --mock

  # Self-test (no PLY file needed):
  python main_orchestrator.py --self-test
""",
    )
    parser.add_argument("--prompt", "-p", type=str, help="Natural-language removal command.")
    parser.add_argument("--input", "-i", type=str, help="Path to input .ply file.")
    parser.add_argument("--output", "-o", type=str, help="Path for pruned output .ply file.")
    parser.add_argument(
        "--mock",
        action="store_true",
        default=False,
        help="Force mock index selection (skip Member 2 resolver). Default: False.",
    )
    parser.add_argument(
        "--mock-fraction",
        type=float,
        default=0.15,
        metavar="F",
        help="Fraction of points to remove in mock mode (0–1). Default: 0.15.",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        default=False,
        help="Run end-to-end self-test with a synthetic PLY and then exit.",
    )
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging verbosity. Default: INFO.",
    )
    return parser


# ---------------------------------------------------------------------------
# Self-test (generates a synthetic PLY, runs the full pipeline)
# ---------------------------------------------------------------------------
def _run_self_test() -> None:
    """
    End-to-end self-test.

    Creates a 5 000-point synthetic PLY, runs the full pipeline in mock mode,
    asserts basic output invariants, and prints the summary.
    """
    import tempfile

    from plyfile import PlyData, PlyElement  # type: ignore

    print("\n" + "=" * 60)
    print("  Chisel AI – End-to-End Self-Test")
    print("=" * 60)

    N = 5_000
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "synthetic_scene.ply")
        dst = os.path.join(tmp, "synthetic_scene_pruned.ply")

        # Build synthetic PLY (x, y, z float32 + a fake opacity field)
        rng = np.random.default_rng(42)
        dt = np.dtype([("x", "f4"), ("y", "f4"), ("z", "f4"), ("opacity", "f4")])
        arr = np.empty(N, dtype=dt)
        arr["x"] = rng.random(N).astype(np.float32)
        arr["y"] = rng.random(N).astype(np.float32)
        arr["z"] = rng.random(N).astype(np.float32)
        arr["opacity"] = rng.random(N).astype(np.float32)
        PlyData([PlyElement.describe(arr, "vertex")], text=False).write(src)
        print(f"\n  Synthetic PLY : {src}")
        print(f"  Vertex count  : {N:,}")

        result = run_pipeline(
            user_prompt="Remove the barber chair",
            input_ply=src,
            output_ply=dst,
            force_mock=True,
            mock_fraction=0.15,
        )

        expected_removed = max(1, int(N * 0.15))
        assert result.original_point_count == N, f"Expected {N}, got {result.original_point_count}"
        assert result.removed_point_count == expected_removed, (
            f"Expected ~{expected_removed} removed, got {result.removed_point_count}"
        )
        assert os.path.isfile(dst), "Output PLY was not written!"

        print("\n  [OK] All assertions passed.")
        print("  [OK] Self-test complete.\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> int:
    parser = _build_arg_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.self_test:
        _run_self_test()
        return 0

    # Normal mode – all three arguments required
    missing = [f"--{k}" for k, v in {"prompt": args.prompt, "input": args.input, "output": args.output}.items() if not v]
    if missing:
        parser.error(f"The following arguments are required: {', '.join(missing)}")

    if args.mock_fraction <= 0 or args.mock_fraction > 1:
        parser.error("--mock-fraction must be in the range (0, 1].")

    try:
        run_pipeline(
            user_prompt=args.prompt,
            input_ply=args.input,
            output_ply=args.output,
            force_mock=args.mock,
            mock_fraction=args.mock_fraction,
        )
        return 0
    except FileNotFoundError as exc:
        logger.error("File not found: %s", exc)
        return 2
    except ValueError as exc:
        logger.error("Value error: %s", exc)
        return 3
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected pipeline error: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
