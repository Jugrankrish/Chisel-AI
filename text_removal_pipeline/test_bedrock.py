#!/usr/bin/env python3
"""
test_bedrock.py — Test AWS Bedrock connectivity for the text removal pipeline.

Run:
    conda activate nerfstudio
    python text_removal_pipeline/test_bedrock.py

What it does:
  1. Checks boto3 is installed
  2. Checks AWS credentials exist
  3. Lists available Anthropic models in your account
  4. Sends a tiny test message to Claude Haiku via Bedrock
  5. Tests llm_agent.parse_user_intent() end-to-end
  6. Tests llm_refine with --agent backend
"""

import json
import logging
import os
import sys
from pathlib import Path

# Add repo root to path
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s"
)

SEP = "─" * 60


def check_boto3():
    print(f"\n{SEP}")
    print("STEP 1 — Check boto3")
    print(SEP)
    try:
        import boto3
        print(f"  ✓ boto3 {boto3.__version__} installed")
        return boto3
    except ImportError:
        print("  ✗ boto3 not installed")
        print("    Fix: conda run -n nerfstudio pip install boto3")
        sys.exit(1)


def check_credentials(boto3):
    print(f"\n{SEP}")
    print("STEP 2 — Check AWS credentials")
    print(SEP)
    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    print(f"  Region: {region}")

    # Check env vars
    key_id     = os.environ.get("AWS_ACCESS_KEY_ID", "")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    profile    = os.environ.get("AWS_PROFILE", "")

    if key_id:
        print(f"  ✓ AWS_ACCESS_KEY_ID set (ends ...{key_id[-4:]})")
    if secret_key:
        print("  ✓ AWS_SECRET_ACCESS_KEY set")
    if profile:
        print(f"  ✓ AWS_PROFILE = {profile}")

    # Check ~/.aws/credentials
    creds_file = Path.home() / ".aws" / "credentials"
    config_file = Path.home() / ".aws" / "config"
    if creds_file.exists():
        print(f"  ✓ ~/.aws/credentials exists")
    if config_file.exists():
        print(f"  ✓ ~/.aws/config exists")

    # Try STS to verify
    try:
        sts = boto3.client("sts", region_name=region)
        identity = sts.get_caller_identity()
        print(f"  ✓ Credentials VALID")
        print(f"    Account : {identity['Account']}")
        print(f"    UserID  : {identity['UserId']}")
        print(f"    ARN     : {identity['Arn']}")
        return True
    except Exception as e:
        print(f"  ✗ Credentials INVALID: {e}")
        print()
        print("  To fix — choose one:")
        print("  A) Set env vars:")
        print("       export AWS_ACCESS_KEY_ID=AKIA...")
        print("       export AWS_SECRET_ACCESS_KEY=...")
        print("       export AWS_DEFAULT_REGION=us-east-1")
        print()
        print("  B) Configure profile:")
        print("       aws configure  (or pip install awscli first)")
        print()
        print("  C) Use IAM role (if running on EC2/SageMaker)")
        return False


def list_bedrock_models(boto3, region):
    print(f"\n{SEP}")
    print("STEP 3 — List available Anthropic models")
    print(SEP)
    try:
        bedrock = boto3.client("bedrock", region_name=region)
        all_models = bedrock.list_foundation_models()["modelSummaries"]
        anthropic = [m for m in all_models if "anthropic" in m["modelId"]]
        if anthropic:
            print(f"  ✓ Found {len(anthropic)} Anthropic model(s):")
            for m in anthropic:
                status = m.get("modelLifecycle", {}).get("status", "?")
                print(f"    - {m['modelId']}  [{status}]")
        else:
            print("  ⚠ No Anthropic models found. You may need to enable them.")
            print("    Go to: AWS Console → Bedrock → Model access → Enable Anthropic")
        return anthropic
    except Exception as e:
        print(f"  ✗ Could not list models: {e}")
        return []


def test_bedrock_invoke(boto3, region):
    print(f"\n{SEP}")
    print("STEP 4 — Test Bedrock invocation (Claude Haiku)")
    print(SEP)
    # Try Haiku first (cheapest), fall back to Sonnet
    model_ids = [
        "anthropic.claude-3-5-haiku-20241022-v1:0",
        "anthropic.claude-3-haiku-20240307-v1:0",
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "anthropic.claude-instant-v1",
    ]
    client = boto3.client("bedrock-runtime", region_name=region)
    for model_id in model_ids:
        print(f"  Trying: {model_id}")
        try:
            response = client.invoke_model(
                modelId=model_id,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 20,
                    "messages": [{"role": "user", "content": "Say 'hi' in one word."}],
                }),
                contentType="application/json",
                accept="application/json",
            )
            result = json.loads(response["body"].read())
            reply  = result["content"][0]["text"].strip()
            print(f"  ✓ SUCCESS! Model: {model_id}")
            print(f"  ✓ Response: '{reply}'")
            os.environ["BEDROCK_MODEL_ID"] = model_id
            return model_id
        except Exception as e:
            err = str(e)
            if "AccessDenied" in err or "not authorized" in err.lower():
                print(f"    ✗ Access denied — model not enabled in your account")
            elif "Could not connect" in err or "EndpointResolution" in err:
                print(f"    ✗ Connection error: {e}")
            else:
                print(f"    ✗ {e}")
    print()
    print("  ✗ All Bedrock models failed.")
    print("  Fix: AWS Console → Bedrock → Model access → Request access for Anthropic")
    return None


def test_llm_agent(model_id):
    print(f"\n{SEP}")
    print("STEP 5 — Test llm_agent.parse_user_intent()")
    print(SEP)
    if model_id:
        os.environ["BEDROCK_MODEL_ID"] = model_id
    try:
        from llm_agent import parse_user_intent
        test_cases = [
            "Remove the truck",
            "Delete the wheel of the truck",
            "Get rid of all the trees please",
            "Can you erase the red sofa?",
        ]
        for prompt in test_cases:
            intent = parse_user_intent(prompt)
            print(f"  Prompt : {prompt!r}")
            print(f"  Intent : {intent}")
            print()
    except Exception as e:
        print(f"  ✗ llm_agent failed: {e}")


def test_llm_refine_agent():
    print(f"\n{SEP}")
    print("STEP 6 — Test llm_refine with --llm agent")
    print(SEP)
    try:
        from text_removal_pipeline.llm_refine import refine_prompt
        prompts = [
            "remove the truck",
            "delete the wheel of the truck",
            "get rid of the background trees",
        ]
        for p in prompts:
            query = refine_prompt(p, backend="agent")
            print(f"  '{p}' → '{query}'")
    except Exception as e:
        print(f"  ✗ llm_refine failed: {e}")


def main():
    print("\n" + "═" * 60)
    print("  BEDROCK CONNECTIVITY TEST")
    print("═" * 60)

    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

    boto3 = check_boto3()
    creds_ok = check_credentials(boto3)

    if not creds_ok:
        print("\n⚠ Skipping Bedrock tests — no valid AWS credentials.")
        print("  The pipeline will still work using --llm none (mock/regex mode).\n")
        # Still test mock fallback
        test_llm_agent(None)
        test_llm_refine_agent()
        return

    list_bedrock_models(boto3, region)
    model_id = test_bedrock_invoke(boto3, region)
    test_llm_agent(model_id)
    test_llm_refine_agent()

    print("\n" + "═" * 60)
    if model_id:
        print("  ✅ Bedrock is connected and working!")
        print(f"  Use: --llm bedrock  or  --llm agent")
        print(f"  Best model: {model_id}")
    else:
        print("  ⚠ Bedrock not available — pipeline works with --llm none")
        print("    (uses keyword-heuristic Mock backend from llm_agent.py)")
    print("═" * 60 + "\n")


if __name__ == "__main__":
    main()
