import torch
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
import cv2
import numpy as np

CHECKPOINT_PATH = "sam_vit_b_01ec64.pth"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[find_truck_mask] Using device: {DEVICE}")

sam = sam_model_registry["vit_b"](checkpoint=CHECKPOINT_PATH)
sam.to(device=DEVICE)
mask_generator = SamAutomaticMaskGenerator(sam)

image = cv2.imread("data/tandt/truck/images/000069.jpg")
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
image = cv2.resize(image, (image.shape[1]//2, image.shape[0]//2))

masks = mask_generator.generate(image)
sorted_masks = sorted(masks, key=lambda m: m['area'], reverse=True)

import os
os.makedirs("mask_previews", exist_ok=True)

# Save the original resized image too, for comparison
cv2.imwrite("mask_previews/original.png", cv2.cvtColor(image, cv2.COLOR_RGB2BGR))

for i, m in enumerate(sorted_masks[:10]):
    mask_img = (m['segmentation'] * 255).astype('uint8')
    cv2.imwrite(f"mask_previews/mask_{i}_area{m['area']}.png", mask_img)
    print(f"Saved mask_{i}_area{m['area']}.png")

print(f"\n[find_truck_mask] Done. Check the mask_previews/ folder.")
