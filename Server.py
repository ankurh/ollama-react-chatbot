import json
import urllib.error
import urllib.request
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

OLLAMA_CHAT_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "llama3.2:3b"

app = FastAPI(title="Basic Ollama Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str = DEFAULT_MODEL


def ollama_is_running() -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_CHAT_URL}/api/tags", timeout=3) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


@app.get("/health")
def health():
    return {"status": "ok", "ollama_running": ollama_is_running()}


@app.post("/v1/chat")
def chat(req: ChatRequest):
    print(f"Received chat request: {req.model} with {len(req.messages)} messages")
    payload = json.dumps({
        "model": req.model,
        "messages": [m.model_dump() for m in req.messages],
        "stream": False,
    }).encode("utf-8")
    print(f"Sending request to Ollama API: {payload.decode('utf-8')}")
    request = urllib.request.Request(
        OLLAMA_CHAT_URL + "/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Ollama returned HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=503, detail=f"Cannot reach Ollama: {exc.reason}")

    reply = data.get("message", {})
    return {
        "model": data.get("model"),
        "message": reply,
        "response": reply.get("content", ""),
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)