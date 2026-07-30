# text_removal_pipeline/README.md

# Text-Guided 3D Gaussian Removal Pipeline

Remove any object from a 3D Gaussian Splatting scene by simply typing what you want removed.  
The pipeline uses **GroundingDINO** (text → bounding boxes) + **SAM** (boxes → masks) + an inverted **clean-gs** projection to blacklist matching Gaussians.

---

## Folder Layout

```
text_removal_pipeline/
├── pipeline.py           ← Run this (main entry point)
├── llm_refine.py         ← Text → grounding query
├── grounded_segment.py   ← GroundingDINO + SAM segmentation
├── remove_gaussians.py   ← Blacklist projection on PLY
├── colmap_utils.py       ← COLMAP → cameras.json (cached)
├── requirements.txt
├── README.md
├── weights/              ← GroundingDINO auto-downloaded here (~700 MB, first run)
├── cache/
│   └── cameras.json      ← Generated once from COLMAP sparse
├── masks/
│   ├── 000001.png        ← Per-image SAM masks (white = object to remove)
│   └── ...
└── outputs/
    └── cleaned.ply       ← Final cleaned Gaussian scene
```

---

## Setup

### 1. Install extra dependencies (once)

```bash
conda activate nerfstudio
pip install -r text_removal_pipeline/requirements.txt
```

> GroundingDINO weights (~700 MB) are **downloaded automatically** on the first run.

### 2. Check that SAM checkpoint exists

```bash
ls sam_vit_b_01ec64.pth   # should be 375 MB
```

---

## Usage

### Remove the truck (default dataset)

```bash
conda activate nerfstudio
python -m text_removal_pipeline.pipeline --text "remove the truck"
```

All default paths are pre-set for the truck dataset:
- Input PLY: `exports/FO_dataset/truck/point_cloud/iteration_30000/point_cloud.ply`
- Images: `data/tandt/truck/images/`
- COLMAP: `data/tandt/truck/sparse/0/`
- Output: `text_removal_pipeline/outputs/cleaned.ply`

### Remove any object (custom scene)

```bash
python -m text_removal_pipeline.pipeline \
  --text "remove the tree" \
  --ply  path/to/your/point_cloud.ply \
  --images     path/to/images/ \
  --colmap_dir path/to/sparse/0/ \
  --output     text_removal_pipeline/outputs/no_tree.ply
```

### Quick test (first 10 images only)

```bash
python -m text_removal_pipeline.pipeline \
  --text "remove the truck" \
  --max_images 10
```

---

## All Arguments

| Argument | Default | Description |
|---|---|---|
| `--text` | *(required)* | What to remove, e.g. `"remove the truck"` |
| `--ply` | truck PLY | Input 3DGS `.ply` file |
| `--images` | truck images | Directory of training images |
| `--colmap_dir` | truck sparse | COLMAP sparse/0 directory |
| `--sam` | `sam_vit_b_01ec64.pth` | SAM checkpoint |
| `--masks` | `masks/` | Directory to save segmentation masks |
| `--output` | `outputs/cleaned.ply` | Output cleaned `.ply` |
| `--llm` | `none` | LLM backend: `none`, `gemini`, `openai`, `ollama` |
| `--box_threshold` | `0.30` | GroundingDINO box confidence |
| `--text_threshold` | `0.25` | GroundingDINO text confidence |
| `--max_images` | `None` (all) | Process only first N images (for testing) |
| `--workers` | all CPUs | Parallel workers for projection step |
| `--force_cameras` | `False` | Re-generate cameras.json even if cached |
| `--skip_segmentation` | `False` | Skip segmentation, use existing masks |

---

## Tuning Tips

- **Too much removed?** Raise `--box_threshold` (e.g. 0.40) to demand higher confidence detections.
- **Nothing detected?** Lower `--box_threshold` (e.g. 0.20) or simplify your text (e.g. `"truck"` instead of `"red pickup truck"`).
- **Wrong object removed?** Re-run with `--skip_segmentation` after manually editing masks in `masks/`.
- **Only want to test?** Add `--max_images 10` to process 10 images quickly, then inspect `masks/`.

---

## How It Works

```
User text  ──► LLM (optional)  ──► Grounding query
                                        │
                                GroundingDINO (per image)
                                        │ bounding boxes
                                      SAM (per image)
                                        │ binary masks
                              masks/000001.png … masks/000251.png
                                        │
                           Blacklist projection (all cameras)
                           "Any Gaussian landing on a masked pixel is removed"
                                        │
                                outputs/cleaned.ply
```

---

## Viewing Results

Open the output `.ply` in any 3D viewer:
- **MeshLab** (free desktop): `File → Import Mesh → cleaned.ply`
- **Supersplat** (browser): https://playcanvas.com/supersplat/editor — drag & drop
- **nerfstudio viewer**: re-load the model
