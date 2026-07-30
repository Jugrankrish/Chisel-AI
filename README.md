<img width="1866" height="985" alt="image" src="https://github.com/user-attachments/assets/f8ad2759-1e15-4edc-9be4-f7adbbe91afa" />Chisel-AI

Text-guided object removal for 3D Gaussian Splatting reconstructions.

Chisel-AI lets you edit a 3D Gaussian Splatting scene using a single natural language instruction, such as "remove the truck." The system parses the instruction, locates the target object across every training image using zero-shot detection and segmentation, projects that understanding back into 3D space using the scene's camera geometry, and removes the corresponding Gaussians from the point cloud. The result is a cleaned .ply file that can be loaded directly into any standard Gaussian Splatting viewer, with no manual masking and no retraining required.

Overview

3D Gaussian Splatting has become one of the fastest methods for reconstructing real-world scenes from a set of photographs. However, editing a completed reconstruction is difficult: removing a single unwanted object typically requires manually selecting and deleting thousands of individual Gaussians, or using 3D selection tools that risk damaging the surrounding geometry.

Chisel-AI automates this process end to end. A user provides a text prompt describing what to remove. The pipeline interprets that instruction, identifies the object across all camera viewpoints used in the original reconstruction, and prunes only the Gaussians associated with that object, leaving the rest of the scene untouched.

How It Works

The pipeline consists of four stages:

1. Intent Parsing A free-text instruction is converted into a structured removal target using a large language model. The system supports a tiered fallback chain across multiple providers (OpenAI, OpenRouter, Gemini, AWS Bedrock) and falls back to a local keyword-based parser if no cloud provider is available, ensuring the pipeline remains functional without any API access.

2. Zero-Shot Detection and Segmentation The extracted target is passed to GroundingDINO for open-vocabulary object detection across every training image in the dataset. Detected bounding boxes are then refined into pixel-precise masks using Segment Anything (SAM). No manual annotation or per-scene retraining is required.

3. 2D to 3D Projection Using the camera poses recovered by COLMAP during the original reconstruction, each 2D segmentation mask is projected back into 3D space. Consensus across multiple viewpoints is used to determine which Gaussians correspond to the target object, reducing the impact of any single view's detection errors.

4. Pruning The identified Gaussians are removed from the point cloud, and a cleaned .ply file is written to disk, ready for immediate use in downstream rendering or viewing tools.

Results

The pipeline was validated on a reconstructed street scene containing a truck.

Metric	Before	After
Gaussian count	2.05 million	1.41 million
Reduction	—	31%
Target object	Present	Removed
Installation
bash
git clone https://github.com/Jugrankrish/Chisel-AI.git
cd Chisel-AI
pip install -r requirements.txt

A CUDA-capable GPU is strongly recommended. Grounding DINO and SAM are both run locally and benefit significantly from GPU acceleration; segmentation across a full multi-view dataset on CPU alone is impractical.

Usage

Run the pipeline with a text prompt describing the object to remove:

bash
python -m text_removal_pipeline.pipeline --text "remove the truck" --llm agent

Key arguments:

Argument	Description
--text	Natural language instruction describing the removal target
--llm	LLM backend to use for intent parsing (agent enables the full fallback chain)
--ply	Path to the input Gaussian Splatting .ply file
--cameras	Path to the COLMAP-derived cameras.json file
--masks	Directory used to store intermediate segmentation masks
--output	Path for the resulting cleaned .ply file
--box_threshold	Detection confidence threshold passed to GroundingDINO (lower this if the target object is not being detected)

The pipeline prints progress through each of its four stages and reports the total, removed, and retained Gaussian counts on completion.

Configuration

LLM provider credentials are read from a .env file in the project root. At minimum, one of the following should be configured:

OPENAI_API_KEY= Your key
OPENROUTER_API_KEY= Your key
GEMINI_API_KEY= Your key

AWS Bedrock credentials, if used, follow the standard AWS credential resolution order (environment variables, shared credentials file, or IAM role). If no credentials are configured for any provider, the pipeline automatically falls back to a local keyword-based parser and continues to function without external API access.

Limitations

The current implementation removes the target object's Gaussians but does not reconstruct the scene geometry or texture behind the removed object. Because the original photographs never captured what lies behind the object from any angle, the resulting scene contains a visible gap in that region. Addressing this is the primary focus of ongoing work.

Additional current limitations:

A single removal target is processed per run; multi-object removal in one pass is not yet supported.
Detection quality depends on GroundingDINO's zero-shot performance for the given text query; ambiguous or highly unusual object descriptions may require threshold tuning.
No interactive preview of the segmentation mask is currently provided before pruning is committed.
Roadmap
Geometric and textural in painting to fill the void left behind removed objects.
Support for removing multiple distinct objects in a single pipeline run.
An interactive preview step allowing users to review and adjust masks before committing to a prune.
Batch processing support to reduce peak GPU memory usage on lower-VRAM hardware.
Acknowledgments

Before Processing:
<img width="1866" height="985" alt="image" src="https://github.com/user-attachments/assets/5b0e16c6-3e0c-4210-9611-b81c9d929b17" />

After Processing:
<img width="1866" height="985" alt="image" src="https://github.com/user-attachments/assets/7631c8bb-7777-4333-b873-71465bfb7a21" />


This project is built on top of Clean-GS, used under the MIT License, and extends it with an automated text-to-edit pipeline covering LLM-based intent parsing, zero-shot detection and segmentation, and multi-view 3D projection. Credit to the original authors for the foundational spatial filtering and projection work this project builds upon.

This project also depends on the following open-source components:

GroundingDINO for open-vocabulary object detection
Segment Anything (SAM) for image segmentation
COLMAP for camera pose estimation
License

This project is released under the MIT License. See the LICENSE file for details.
