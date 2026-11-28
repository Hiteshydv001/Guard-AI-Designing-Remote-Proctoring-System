"""Minimal async client for Groq's OpenAI-compatible chat completions API (with tool calling)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastapi import HTTPException

from ..core.config import settings

log = logging.getLogger("guardai.assistant")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _retry_after(res: httpx.Response) -> float:
    try:
        return float(res.headers.get("retry-after", "0"))
    except ValueError:
        return 0.0


async def _post(client: httpx.AsyncClient, model: str, payload: dict) -> httpx.Response:
    return await client.post(
        GROQ_URL, headers={"Authorization": f"Bearer {settings.groq_api_key}"}, json={**payload, "model": model}
    )


async def chat(messages: list[dict], tools: list[dict], *, max_tokens: int = 3000) -> dict[str, Any]:
    """Return the assistant message ({role, content, tool_calls?}) for one completion step.

    On a rate limit it switches to the fallback model, then waits once for a short reset.
    """
    if not settings.groq_api_key:
        raise HTTPException(503, "The assistant is not configured (GROQ_API_KEY is missing on the server)")
    payload = {"messages": messages, "tools": tools, "tool_choice": "auto", "temperature": 0.3, "max_tokens": max_tokens}
    models = [
        settings.groq_model,
        *([settings.groq_fallback_model] if settings.groq_fallback_model != settings.groq_model else []),
    ]
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            for model in models:
                res = await _post(client, model, payload)
                if res.status_code != 429:
                    break
                log.warning("Groq rate limit on %s (retry-after %ss)", model, res.headers.get("retry-after"))
            if res.status_code == 429 and 0 < (wait := _retry_after(res)) <= 12:
                await asyncio.sleep(wait)
                res = await _post(client, models[-1], payload)
    except httpx.HTTPError as exc:
        log.error("Groq unreachable: %s", exc)
        raise HTTPException(502, "Couldn't reach the AI service. Try again in a moment.") from exc
    if res.status_code == 429:
        wait = int(_retry_after(res)) or 30
        raise HTTPException(429, f"The assistant hit its free-tier limit. Try again in about {wait} seconds.")
    if not res.is_success:
        log.error("Groq error %s: %s", res.status_code, res.text[:500])
        raise HTTPException(502, "The AI service returned an error. Try rephrasing or try again.")
    msg = res.json()["choices"][0]["message"]
    out: dict[str, Any] = {"role": "assistant", "content": msg.get("content") or ""}
    if msg.get("tool_calls"):
        out["tool_calls"] = [
            {
                "id": c["id"],
                "type": "function",
                "function": {"name": c["function"]["name"], "arguments": c["function"]["arguments"]},
            }
            for c in msg["tool_calls"]
        ]
    return out
