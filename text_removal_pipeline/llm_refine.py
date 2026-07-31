#!/usr/bin/env python3
"""
llm_refine.py — Refine a user's free-form text into a clean GroundingDINO query.

Default backend: agent (llm_agent.py chain: OpenAI → OpenRouter → Gemini → Mock)

Supported backends (--llm flag):
  agent   — llm_agent.py chain (OpenAI → OpenRouter → Gemini → Mock) ← DEFAULT
  ollama  — Local Ollama with qwen2.5:0.5b (no API key, fully local)
  none    — Regex verb-strip fallback (instant, offline)
  bedrock — AWS Bedrock Claude (needs AWS credentials)
  gemini  — Google Gemini API (needs GEMINI_API_KEY)
  openai  — OpenAI API (needs OPENAI_API_KEY)

Fail-safe: every backend falls back to the raw input text if it errors,
so the pipeline NEVER crashes due to an LLM issue.
"""

import os
import sys
from pathlib import Path

# Make sure the repo root is on sys.path for llm_agent import
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Auto-load .env from repo root
_ENV_FILE = _REPO_ROOT / ".env"
_PLACEHOLDER_VALUES = {"PASTE_YOUR_FULL_KEY_HERE", "", "sk-your-real-key-here"}
if _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            _k, _v = _k.strip(), _v.strip()
            if _v and _v not in _PLACEHOLDER_VALUES:
                os.environ.setdefault(_k, _v)


GROUNDING_SYSTEM_PROMPT = """\
You are a computer vision assistant. Convert the user's natural language object removal \
request into a concise GroundingDINO detection query.

Rules:
- Output ONLY the detection query, no explanation.
- Use lowercase dot-separated terms for multiple concepts: e.g. "truck . vehicle . car"
- Be specific but not overly narrow.
- If the user says "remove X", extract just X.

Examples:
  User: "remove the red truck"   → "truck . red truck . vehicle"
  User: "delete the tree"        → "tree . trees"
  User: "get rid of the person"  → "person . human"
  User: "remove background"      → "background . sky . ground"
"""


def refine_prompt(text: str, backend: str = "agent") -> str:
    """
    Refine user text into a GroundingDINO detection query string.

    Args:
        text:    Raw user input, e.g. "remove the truck"
        backend: One of "agent" (default), "ollama", "none", "bedrock",
                 "gemini", "openai"

    Returns:
        Grounding query string, e.g. "truck"
        Falls back to returning raw text if all backends fail.
    """
    backend = backend.lower().strip()

    if backend == "ollama":
        return _call_ollama(text)

    elif backend == "none":
        return _clean_raw(text)

    elif backend == "agent":
        return _call_agent(text)

    elif backend == "bedrock":
        return _call_bedrock_direct(text)

    elif backend == "gemini":
        return _call_gemini(text)

    elif backend == "openai":
        return _call_openai(text)

    else:
        print(f"[llm_refine] Unknown backend '{backend}', falling back to ollama.")
        return _call_ollama(text)


# ─── Backend: none ────────────────────────────────────────────────────────────

def _clean_raw(text: str) -> str:
    """Strip common removal verbs and return the object phrase."""
    removal_prefixes = [
        "remove the ", "remove ", "delete the ", "delete ",
        "get rid of the ", "get rid of ", "erase the ", "erase ",
        "eliminate the ", "eliminate ", "clear the ", "clear ",
    ]
    query = text.strip().lower()
    for prefix in removal_prefixes:
        if query.startswith(prefix):
            query = query[len(prefix):]
            break
    print(f"[llm_refine] (none) '{text}' → '{query}'")
    return query


# ─── Backend: agent — uses llm_agent.py (Bedrock → OpenAI → Mock chain) ─────

def _call_agent(text: str) -> str:
    """
    Use llm_agent.parse_user_intent() — the full Bedrock→OpenAI→Mock chain.
    Returns the 'target' field from the JSON response as the grounding query.
    Falls back to _clean_raw() if the agent fails or returns 'unknown'.
    """
    try:
        from llm_agent import parse_user_intent
        intent = parse_user_intent(text)
        target = intent.get("target", "").strip()
        if not target or target == "unknown":
            print(f"[llm_refine] (agent) returned 'unknown', falling back to none.")
            return _clean_raw(text)
        print(f"[llm_refine] (agent) '{text}' → '{target}'  [via {_detect_backend()}]")
        return target
    except Exception as e:
        print(f"[llm_refine] (agent) failed: {e}. Falling back to none.")
        return _clean_raw(text)


def _detect_backend() -> str:
    """Return which backend the agent will use (for logging)."""
    try:
        import boto3
        boto3.client("bedrock-runtime", region_name="us-east-1")
        return "Bedrock"
    except Exception:
        pass
    if os.environ.get("OPENAI_API_KEY"):
        return "OpenAI"
    return "Mock"


# ─── Backend: bedrock — direct Bedrock call (GroundingDINO-style output) ─────

def _call_bedrock_direct(text: str) -> str:
    """
    Direct AWS Bedrock call — returns a grounding query string (not JSON).
    Uses Claude 3.5 Haiku (fast, cheap).
    """
    try:
        import boto3
        region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        model  = os.environ.get(
            "BEDROCK_MODEL_ID",
            "anthropic.claude-3-5-haiku-20241022-v1:0"
        )
        client = boto3.client("bedrock-runtime", region_name=region)
        import json
        response = client.invoke_model(
            modelId=model,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 30,
                "system": GROUNDING_SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": text}],
            }),
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        query  = result["content"][0]["text"].strip().strip('"').strip("'")
        print(f"[llm_refine] (bedrock) '{text}' → '{query}'")
        return query
    except Exception as e:
        print(f"[llm_refine] Bedrock failed ({e}), falling back to none.")
        return _clean_raw(text)


# ─── Backend: gemini ──────────────────────────────────────────────────────────

def _call_gemini(text: str) -> str:
    """Use the new google-genai SDK (gemini-2.0-flash)."""
    try:
        from google import genai
        from google.genai import types
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        model   = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        client  = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=f"{GROUNDING_SYSTEM_PROMPT}\n\nUser: {text}",
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=50,
            ),
        )
        query = response.text.strip().strip('"').strip("'")
        print(f"[llm_refine] (gemini) '{text}' → '{query}'")
        return query
    except Exception as e:
        print(f"[llm_refine] Gemini failed ({e}), falling back to none.")
        return _clean_raw(text)


# ─── Backend: openai ──────────────────────────────────────────────────────────

def _call_openai(text: str) -> str:
    try:
        from openai import OpenAI
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        client   = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": GROUNDING_SYSTEM_PROMPT},
                {"role": "user",   "content": text},
            ],
            max_tokens=50,
            temperature=0,
        )
        query = response.choices[0].message.content.strip().strip('"').strip("'")
        print(f"[llm_refine] (openai) '{text}' → '{query}'")
        return query
    except Exception as e:
        print(f"[llm_refine] OpenAI failed ({e}), falling back to none.")
        return _clean_raw(text)


# ─── Backend: ollama (DEFAULT) ────────────────────────────────────────────────

# Ollama server URL and model — configurable via env vars
_OLLAMA_URL   = os.environ.get("OLLAMA_URL",   "http://localhost:11434/api/generate")
_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL",  "qwen2.5:0.5b")

# Exact prompt template as specified
_OLLAMA_PROMPT_TEMPLATE = (
    "Extract ONLY the primary target object from this sentence as a single short "
    "noun phrase with no punctuation or extra words. "
    "Sentence: '{user_text}'. Target Object:"
)


def _call_ollama(text: str) -> str:
    """
    POST to Ollama /api/generate with qwen2.5:0.5b.
    Falls back to returning user_text as-is if Ollama is unreachable or errors.
    """
    import json
    import urllib.request
    import urllib.error
    import warnings

    prompt = _OLLAMA_PROMPT_TEMPLATE.format(user_text=text)
    payload = json.dumps({
        "model":  _OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.0,
            "num_predict": 20,   # short noun phrase only
        },
    }).encode()

    try:
        req = urllib.request.Request(
            _OLLAMA_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())

        # Strip whitespace, quotes, and trailing punctuation from response
        query = result.get("response", "").strip()
        query = query.strip('"').strip("'").strip(".")
        # Take only the first line in case model adds explanation
        query = query.splitlines()[0].strip() if query else ""

        if not query:
            warnings.warn("[llm_refine] Ollama returned empty response, using raw text.")
            return text

        print(f"[llm_refine] (ollama/{_OLLAMA_MODEL}) '{text}' → '{query}'")
        return query

    except urllib.error.URLError as e:
        warnings.warn(
            f"[llm_refine] Ollama unreachable at {_OLLAMA_URL} ({e}). "
            f"Is 'ollama serve' running? Falling back to raw text."
        )
        return text
    except Exception as e:
        warnings.warn(f"[llm_refine] Ollama error ({e}). Falling back to raw text.")
        return text


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse, logging
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    parser = argparse.ArgumentParser(
        description="Refine removal text to a GroundingDINO query (default: agent)"
    )
    parser.add_argument("--text", required=True, help="User removal text")
    parser.add_argument("--llm", default="agent",
                        choices=["agent", "ollama", "none", "bedrock", "gemini", "openai"],
                        help="LLM backend (default: agent)")
    args   = parser.parse_args()
    result = refine_prompt(args.text, args.llm)
    print(f"\nGrounding query: '{result}'")
