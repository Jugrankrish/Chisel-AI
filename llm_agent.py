"""
chisel_ai/llm_agent.py
=======================
LLM Intent Parser – Member 3 (Agent Logic & Pipeline Orchestrator)

Connects to an LLM backend and converts a free-text user command into a
strict JSON action descriptor:

    {"action": "remove", "target": "<object_name_string>"}

Priority order for backend selection:
    1. OpenAI - if OPENAI_API_KEY is set (PRIMARY)
    2. OpenRouter - if OPENROUTER_API_KEY is set
    3. Google Gemini  – if GEMINI_API_KEY is set
    4. AWS Bedrock (Claude) – if AWS credentials are available
    5. Local Mock – always available, keyword-based heuristic for testing
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Auto-load .env from the repo root (if it exists)
# ---------------------------------------------------------------------------
_ENV_FILE = Path(__file__).resolve().parent / ".env"
_PLACEHOLDER_VALUES = {"PASTE_YOUR_FULL_KEY_HERE", "", "sk-your-real-key-here"}
if _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            _k, _v = _k.strip(), _v.strip()
            # Skip placeholder/empty values so they don't shadow real env vars
            if _v and _v not in _PLACEHOLDER_VALUES:
                os.environ.setdefault(_k, _v)

# ---------------------------------------------------------------------------
# System prompt – forces strict JSON-only responses from the model
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """You are a 3D scene editing assistant that prepares object names
for an open-vocabulary object detector (GroundingDINO).

The user will give you a natural-language instruction to modify a 3D scene.
Extract the target object, then REWRITE it as the simplest, most common
English term a photo captioning dataset would use — not the user's exact wording.

Rules:
- Prefer short, standard, visually concrete nouns (1-3 words).
- If the phrase is vague, awkward, or non-standard (e.g. "carrier of truck"),
  translate it to the real-world part name a detector would recognize
  (e.g. "truck bed", "cargo box", "flatbed").
- Never invent objects that don't correspond to a real physical part.
- Avoid possessives and prepositional phrasing ("of X", "on the Y") in the output.

You MUST respond with ONLY valid JSON – nothing else, no markdown, no explanation.
Schema:
{
  "action": "remove",
  "target": "<short, standard, detector-friendly object name>"
}

Examples:
  User: "Delete the barber chair"           → {"action": "remove", "target": "chair"}
  User: "remove the carrier of truck"       → {"action": "remove", "target": "truck bed"}
  User: "get rid of the thing on the roof"  → {"action": "remove", "target": "roof rack"}
  User: "erase that pole holding the sign"  → {"action": "remove", "target": "sign post"}

If you cannot identify a valid, real object, respond with:
  {"action": "remove", "target": "unknown"}
"""

_USER_TEMPLATE = "User instruction: \"{prompt}\""

# ---------------------------------------------------------------------------
# Regex-based JSON extractor (resilient to extra surrounding text)
# ---------------------------------------------------------------------------
_JSON_BLOCK_RE = re.compile(r"\{.*?\}", re.DOTALL)


def _extract_intent_json(raw_text: str) -> dict:
    """
    Extract the first JSON object from *raw_text*.
    Falls back to a minimal error dict if nothing parseable is found.
    """
    raw_stripped = raw_text.strip()
    # Strip markdown code fences if present
    raw_stripped = re.sub(r"```(?:json)?", "", raw_stripped).strip()
    try:
        return json.loads(raw_stripped)
    except json.JSONDecodeError:
        pass

    match = _JSON_BLOCK_RE.search(raw_stripped)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            logger.warning("Regex found a JSON-like block but it failed to parse: %s", match.group())

    logger.warning("Could not extract JSON from LLM response: %r", raw_text)
    return {"action": "remove", "target": "unknown"}


def _validate_intent(intent: dict) -> dict:
    """Ensure the intent dict has the required fields with expected types."""
    action = intent.get("action", "remove")
    target = intent.get("target", "unknown")

    if not isinstance(action, str) or not isinstance(target, str):
        logger.warning("Intent fields have unexpected types – coercing to strings.")
        action = str(action)
        target = str(target)

    return {
        "action": action.strip().lower(),
        "target": target.strip().lower(),
    }


# ---------------------------------------------------------------------------
# Backend 1 – Google Gemini (PRIMARY — you have the API key)
# ---------------------------------------------------------------------------

# Gemini model to use — 2.0-flash is fast and free-tier friendly
_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def _parse_with_gemini(user_prompt: str) -> Optional[dict]:
    """
    Call Google Gemini API using the new google-genai SDK.
    Returns parsed intent dict or None on any failure.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.debug("GEMINI_API_KEY not set – skipping Gemini backend.")
        return None

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.debug("google-genai not installed – skipping Gemini backend.")
        logger.debug("  Fix: pip install google-genai")
        return None

    try:
        client = genai.Client(api_key=api_key)
        full_prompt = f"{_SYSTEM_PROMPT}\n\n{_USER_TEMPLATE.format(prompt=user_prompt)}"

        response = client.models.generate_content(
            model=_GEMINI_MODEL,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=100,
            ),
        )

        raw_text = response.text.strip()
        logger.info("[Gemini] Raw response: %r", raw_text)
        return _validate_intent(_extract_intent_json(raw_text))

    except Exception as exc:
        logger.warning("[Gemini] Request failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Backend 2 – AWS Bedrock (Claude)
# ---------------------------------------------------------------------------

def _parse_with_bedrock(
    user_prompt: str,
    model_id: str = "anthropic.claude-3-5-haiku-20241022-v1:0",
) -> Optional[dict]:
    """
    Call AWS Bedrock via boto3 (Claude Messages API).
    Returns parsed intent dict or None on any failure.
    """
    try:
        import boto3
    except ImportError:
        logger.debug("boto3 not installed – skipping Bedrock backend.")
        return None

    try:
        client = boto3.client(
            "bedrock-runtime",
            region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        )
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 256,
            "system": _SYSTEM_PROMPT,
            "messages": [
                {"role": "user", "content": _USER_TEMPLATE.format(prompt=user_prompt)},
            ],
        })
        response = client.invoke_model(
            modelId=model_id,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        response_body = json.loads(response["body"].read())
        raw_text = response_body["content"][0]["text"]
        logger.info("[Bedrock] Raw LLM response: %r", raw_text)
        return _validate_intent(_extract_intent_json(raw_text))

    except Exception as exc:
        logger.warning("[Bedrock] Request failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Backend 3 – OpenAI (GPT-4o / gpt-3.5-turbo)
# ---------------------------------------------------------------------------

def _parse_with_openai(user_prompt: str, model: str = "gpt-4o-mini") -> Optional[dict]:
    """
    Call OpenAI Chat Completions API.
    Returns parsed intent dict or None on any failure.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.debug("OPENAI_API_KEY not set – skipping OpenAI backend.")
        return None

    try:
        from openai import OpenAI
    except ImportError:
        logger.debug("openai package not installed – skipping OpenAI backend.")
        return None

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _USER_TEMPLATE.format(prompt=user_prompt)},
            ],
            max_tokens=256,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw_text = response.choices[0].message.content or ""
        logger.info("[OpenAI] Raw LLM response: %r", raw_text)
        return _validate_intent(_extract_intent_json(raw_text))

    except Exception as exc:
        logger.warning("[OpenAI] Request failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Backend 4 – OpenRouter
# ---------------------------------------------------------------------------

def _parse_with_openrouter(user_prompt: str, model: str = "openai/gpt-4o-mini") -> Optional[dict]:
    """
    Call OpenRouter API (using the OpenAI client).
    Returns parsed intent dict or None on any failure.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        logger.debug("OPENROUTER_API_KEY not set – skipping OpenRouter backend.")
        return None

    try:
        from openai import OpenAI
    except ImportError:
        logger.debug("openai package not installed – skipping OpenRouter backend.")
        return None

    try:
        # OpenRouter uses the OpenAI SDK format
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _USER_TEMPLATE.format(prompt=user_prompt)},
            ],
            max_tokens=256,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw_text = response.choices[0].message.content or ""
        logger.info("[OpenRouter] Raw LLM response: %r", raw_text)
        return _validate_intent(_extract_intent_json(raw_text))

    except Exception as exc:
        logger.warning("[OpenRouter] Request failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Backend 5 – Local Mock (keyword heuristic, no API required)
# ---------------------------------------------------------------------------

_REMOVE_KEYWORDS = {
    "remove", "delete", "erase", "eliminate", "get rid of",
    "clear", "wipe", "drop", "take out", "take away",
    "hide", "destroy", "cut", "strip",
}

_STOPWORDS = {
    "the", "a", "an", "all", "of", "please", "from", "scene",
    "my", "this", "that", "those", "these",
}


def _parse_with_mock(user_prompt: str) -> dict:
    """
    Heuristic keyword parser used when no LLM backend is available.
    """
    prompt_lower = user_prompt.lower()

    found_verb: Optional[str] = None
    verb_pos = len(prompt_lower)

    for kw in sorted(_REMOVE_KEYWORDS, key=len, reverse=True):
        idx = prompt_lower.find(kw)
        if idx != -1 and idx < verb_pos:
            found_verb = kw
            verb_pos = idx

    if found_verb is None:
        logger.info("[Mock] No removal verb detected; defaulting target to 'unknown'.")
        return {"action": "remove", "target": "unknown"}

    after_verb = prompt_lower[verb_pos + len(found_verb):].strip()
    tokens = [t for t in after_verb.split() if t not in _STOPWORDS and t.isalpha()]
    target = " ".join(tokens) if tokens else "unknown"

    logger.info("[Mock] Detected verb=%r, target=%r", found_verb, target)
    return {"action": "remove", "target": target}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_user_intent(user_prompt: str) -> dict:
    """
    Parse *user_prompt* into an intent dict ``{"action": str, "target": str}``.

    Backend selection (first successful response wins):
        OpenAI → OpenRouter → Gemini → Bedrock → Mock

    Parameters
    ----------
    user_prompt:
        The raw natural-language instruction from the user,
        e.g. "Remove the truck" or "Delete the wheel of the truck".

    Returns
    -------
    dict
        ``{"action": "remove", "target": "<object_name>"}``
    """
    if not user_prompt or not user_prompt.strip():
        raise ValueError("user_prompt must be a non-empty string.")

    logger.info("Parsing intent for prompt: %r", user_prompt)

    # Priority: OpenRouter (working) → OpenAI (needs valid sk- key) → Gemini → Bedrock
    for backend_fn, name in [
        (_parse_with_openrouter, "OpenRouter"),
        (_parse_with_openai,     "OpenAI"),
        (_parse_with_gemini,     "Gemini"),
        (_parse_with_bedrock,    "Bedrock"),
    ]:
        result = backend_fn(user_prompt)
        if result is not None and result.get("target", "unknown") != "unknown":
            logger.info("[%s] Intent parsed successfully: %s", name, result)
            return result

    # Local mock fallback
    logger.info("All cloud backends unavailable – using local mock fallback.")
    result = _parse_with_mock(user_prompt)
    logger.info("[Mock] Intent parsed: %s", result)
    return result


# ---------------------------------------------------------------------------
# Quick smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s | %(name)s | %(message)s")

    test_prompts = [
        "Remove the truck",
        "Delete the wheel of the truck",
        "Get rid of all the trees please",
        "Can you erase the red sofa?",
        "Wipe the lamp",
        "What's the weather like?",   # No removal intent – should return 'unknown'
    ]

    print("\n=== llm_agent.py – Smoke Test ===\n")
    for prompt in test_prompts:
        intent = parse_user_intent(prompt)
        print(f"  Prompt : {prompt!r}")
        print(f"  Intent : {intent}\n")
