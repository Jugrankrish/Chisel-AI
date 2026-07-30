import torch
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
import cv2

CHECKPOINT_PATH = "sam_vit_b_01ec64.pth"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[test_sam] Using device: {DEVICE}")

sam = sam_model_registry["vit_b"](checkpoint=CHECKPOINT_PATH)
sam.to(device=DEVICE)

mask_generator = SamAutomaticMaskGenerator(sam)

image = cv2.imread("data/tandt/truck/images/000001.jpg")
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
image = cv2.resize(image, (image.shape[1]//2, image.shape[0]//2))  # downscale for VRAM

masks = mask_generator.generate(image)
print(f"[test_sam] Found {len(masks)} masks in the image")
if masks:
    print(f"[test_sam] Largest mask area: {max(m['area'] for m in masks)} pixels")
