# Ollama React Chatbot

A full-stack chat application pairing a **React** frontend with a **Python (FastAPI)** backend backed by **Ollama** running locally.

## Project Structure

```text
.
├── backend/              # or root Python API script (e.g., main.py / ollama_chat_api.py)
├── frontend/             # or React app directory (src/App.jsx, vite.config.js, etc.)
├── .gitignore
└── README.md
```

## Prerequisites

- **Python 3.10+** with `fastapi`, `uvicorn`, and `pydantic` installed
- **Node.js & npm** for the React frontend
- **Ollama** installed locally with your desired model pulled (for example, `ollama pull llama3.2:3b`)

## Setup & Running Locally

### 1. Start the Python Backend

```powershell
python ollama_chat_api.py
```

Backend runs on `http://127.0.0.1:8000` (or `http://localhost:8000`).

### 2. Start the React Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API & Frontend Flow

- **`GET /health`**: Checks whether the backend and Ollama service are reachable.
- **`POST /v1/chat`** (or `/chat`): Accepts JSON with `messages` and `model` (such as `"llama3.2:3b"`), forwards requests to Ollama (`http://127.0.0.1:11434`), and returns or streams the assistant reply to React.

## Common Troubleshooting

- **CORS errors (`No 'Access-Control-Allow-Origin'`):** Confirm `CORSMiddleware` allows `http://localhost:5173` (and `http://127.0.0.1:5173`), no stale process is holding port `8000`, and your React `fetch` URL uses `http://` rather than `https://`.
- **Port / connection issues:** Verify Ollama is running on port `11434` and the requested model is listed in `ollama list`.