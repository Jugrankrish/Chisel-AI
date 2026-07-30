🛠️ Chisel-AI: Text-Guided 3D Gaussian Sculpting

Chisel-AI is an automated, text-driven pipeline that lets you isolate, extract, and clean objects from 3D Gaussian Splatting (3DGS) scenes using nothing but natural language.

Editing raw point clouds and 3D Gaussians is traditionally tedious, requiring manual lasso tools and hours of cleanup. Chisel-AI solves this by bridging Large Language Models (LLMs), 2D Vision Foundation Models (SAM), and 3D projection algorithms to automatically "chisel" away unwanted parts of your 3D scene.
The Pipeline

Our architecture operates in four distinct phases to map human intent into 3D space:

    Input Generation: We start with a 3DGS .ply file. This can be directly downloaded or generated from a raw video using a standard COLMAP + Nerfstudio pipeline.

    LLM Prompt Optimization: Instead of sending raw user input directly to a vision model, the text prompt is passed through an LLM via OpenRouter. The LLM acts as an intelligent translator, converting simple requests (e.g., "the statue") into highly precise, descriptive instructions optimized for visual segmentation.

    2D Segmentation (SAM): The LLM's precise instructions are fed into the Segment Anything Model (SAM). SAM analyzes the 2D training views of the scene and generates pixel-perfect 2D binary masks for the target object.

    3D Sculpting (Clean-GS Integration): The 2D masks and the original .ply file are passed into our integration of the Clean-GS algorithm. This mathematically projects the 2D masks into the 3D space, pruning away every Gaussian splat that falls outside the masked boundaries, outputting a clean, isolated 3D .ply model.

What We Built vs. Our Foundations

To make this project possible for the hackathon, we built upon incredible existing open-source research. It is important to distinguish our pipeline from the backend code that powers it:

    The Foundation (Clean-GS): We integrated code from the Clean-GS research paper. Clean-GS provides the brilliant mathematical logic required to take pre-existing 2D masks and use them to filter out floaters and background noise in a 3DGS .ply file based on projection and color validation.

    Our Contribution (Chisel-AI): The original Clean-GS requires you to already have 2D masks. Chisel-AI builds an end-to-end automated brain on top of this. We engineered the LLM + SAM bridge that generates those masks dynamically from a simple text prompt. By orchestrating OpenRouter, SAM, and Clean-GS into a single automated pipeline, we turned a mathematical filtering tool into an accessible, zero-shot 3D text-to-sculpting engine.

Installation

Clone the repository and set up the environment:
Bash

git clone https://github.com/Jugrankrish/Chisel-AI.git
cd Chisel-AI

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

You will need an OpenRouter API Key to power the LLM instruction layer. Set it as an environment variable:
Bash

export OPENROUTER_API_KEY="your_api_key_here"

Usage

Run the complete pipeline with a single command. Point it to your dataset (which contains the 2D images and cameras.json), your raw .ply file, and your text prompt.
Bash

python chisel.py \
  --scene_dir data/my_scene \
  --input_ply data/my_scene/point_cloud.ply \
  --prompt "The red vintage car parked on the street" \
  --output_ply output/chiseled_car.ply

What happens next?

    The LLM translates "The red vintage car..." into a SAM-optimized prompt.

    SAM masks the car in your scene_dir images.

    Clean-GS projects those masks and sculpts your .ply.

    Your perfectly isolated 3D object is saved to output/chiseled_car.ply.

Acknowledgements & Credits

This hackathon project stands on the shoulders of giants. Massive credit to the following projects and teams:

    Clean-GS: For the core 3D projection and pruning algorithms. Their research is what makes the final 2D-to-3D lift possible.

    Segment Anything (SAM): Meta's vision foundation model for generating the 2D masks.

    Nerfstudio / COLMAP: For providing the tools to generate the initial 3D Gaussian Splatting scenes.

    OpenRouter: For the LLM API routing that powers our prompt optimization layer.


Before Pic: 
<img width="1862" height="988" alt="image" src="https://github.com/user-attachments/assets/d5b4fec1-916f-4f6c-a6c7-86313daf4e82" />

After Processing Removing Truck:
![Uploading image.png…]()
