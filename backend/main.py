from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from typing import Dict, List
import os
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    sessionId: str | None = None


class Settings(BaseSettings):
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")

    class Config:
        env_file = ".env"


settings = Settings()  # reads from environment if available
SYSTEM_PROMPT = (
    "You are Hamo (하모), a friendly, expert travel guide for Jinju,"
    " Gyeongsangnam-do, South Korea. You speak Korean naturally."
    " Keep answers brief and easy to skim: prefer 1–4 short sentences (max 6)."
    " Use bullets only when a list is truly helpful (max 5)."
    " Focus on essentials: attractions, food, hours, fees, tips."
    " Avoid long paragraphs and unnecessary detail."
    " Ask at most one clarifying question only if intent is unclear, and never ask repeated follow-up questions on the same topic."
    " If the user does not answer the clarifying question or the request is already clear, proceed without asking more questions."
)
SESSION_HISTORY: Dict[str, List[dict]] = {}
MAX_TURNS = 20


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/chat")
async def chat(req: ChatRequest):
    user = req.message.strip()
    if not user:
        raise HTTPException(status_code=400, detail="message is empty")
    session_id = req.sessionId or "default"

    # build or get history
    history = SESSION_HISTORY.get(session_id)
    if history is None:
        history = [{"role": "system", "content": SYSTEM_PROMPT}]
        SESSION_HISTORY[session_id] = history
    history.append({"role": "user", "content": user})
    # prune
    non_system = [m for m in history if m.get("role") != "system"]
    if len(non_system) > MAX_TURNS * 2:
        history[:] = [history[0]] + non_system[-MAX_TURNS * 2 :]

    # If no API key configured, fallback to echo so frontend still works
    if not settings.OPENAI_API_KEY:
        echo = f"(echo) {user}"
        history.append({"role": "assistant", "content": echo})
        return {"reply": echo}

    try:
        async with httpx.AsyncClient(base_url=settings.OPENAI_BASE_URL, timeout=40.0) as client:
            resp = await client.post(
                "/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": history,
                },
            )
            if resp.status_code != 200:
                return {"error": f"openai_{resp.status_code}", "detail": resp.text}
            data = resp.json()
            choice0 = data.get("choices", [{}])[0]
            msg = choice0.get("message", {}).get("content")
            if not msg:
                return {"error": "no_content", "detail": data}
            reply_text = msg.strip()
            history.append({"role": "assistant", "content": reply_text})
            return {"reply": reply_text}
    except httpx.HTTPError as e:
        return {"error": "network_error", "detail": str(e)}
    except Exception as e:
        return {"error": "unknown_error", "detail": str(e)}


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None  # e.g., "cute"


@app.post("/tts")
async def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is empty")
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set")

    # Map our custom voice label to model voice
    voice = (req.voice or "sage").lower()
    # Map to brighter, younger-sounding Korean kid voices the model provides
    ko_boy_aliases = ("ko-boy", "korean-boy", "kboy", "boy", "kid-male", "young-boy", "bright-boy")
    ko_girl_aliases = ("ko-girl", "korean-girl", "kgirl", "girl", "kid-female", "young-girl", "bright-girl", "cute-girl", "cute", "bright", "child", "kid", "young")
    if voice in ko_girl_aliases:
        model_voice = "sage"   # bright, cute, young female tone (OpenAI preset)
    elif voice in ko_boy_aliases:
        model_voice = "verse"  # bright youthful male tone
    else:
        # if explicitly provided voice (e.g., 'sage', 'verse', 'alloy'), pass through
        model_voice = voice if voice in ("sage", "verse", "alloy", "aria", "alto") else "sage"

    try:
        async with httpx.AsyncClient(base_url=settings.OPENAI_BASE_URL, timeout=60.0) as client:
            resp = await client.post(
                "/audio/speech",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Accept": "audio/mpeg",
                },
                json={
                    "model": "gpt-4o-mini-tts",
                    "voice": model_voice,
                    "input": text,
                    "format": "mp3",
                },
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            audio_bytes = resp.content
            return Response(content=audio_bytes, media_type="audio/mpeg")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))

