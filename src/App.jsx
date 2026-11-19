import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = "http://127.0.0.1:8000";
const MODEL = "llama3.2:3b";

const SUGGESTIONS = [
  "Explain how large language models work, simply",
  "Write a Python function that reverses a string",
  "Give me 5 ideas for a weekend project",
  "Summarize the pros and cons of remote work",
];

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Renders **bold** and `inline code` inside a line of text.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key} className="inline-code">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Splits a reply into fenced ``` code blocks and normal text.
function MessageContent({ text }) {
  const segments = text.split(/```/);
  return segments.map((seg, i) => {
    if (i % 2 === 1) {
      const newline = seg.indexOf("\n");
      const lang = newline > -1 ? seg.slice(0, newline).trim() : "";
      const code = newline > -1 ? seg.slice(newline + 1) : seg;
      return <CodeBlock key={i} lang={lang} code={code.replace(/\n$/, "")} />;
    }
    if (!seg) return null;
    return (
      <div key={i} className="text">
        {seg.split("\n").map((line, j, arr) => (
          <span key={j}>
            {renderInline(line, `${i}-${j}`)}
            {j < arr.length - 1 && "\n"}
          </span>
        ))}
      </div>
    );
  });
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }
  return (
    <button type="button" className="ghost-btn" onClick={copy}>
      {copied ? "Copied!" : label}
    </button>
  );
}

function CodeBlock({ lang, code }) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang || "code"}</span>
        <CopyButton text={code} />
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="typing" aria-label="Assistant is typing">
      <span /><span /><span />
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llamaUp, setLlamaUp] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  function fetchHealth() {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setLlamaUp(Boolean(d.llama ?? d.ollama_running)))
      .catch(() => setLlamaUp(false));
  }

  function checkHealth() {
    setLlamaUp(null);
    fetchHealth();
  }

  useEffect(fetchHealth, []);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Grow the textarea with its content, up to a limit.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (!input) return; // empty: keep the natural one-line height
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  async function sendText(raw, history = messages) {
    const text = raw.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, time: timeNow() };
    const conversation = [...history.filter((m) => !m.error), userMsg];

    setMessages(conversation);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map(({ role, content }) => ({ role, content })),
          model: MODEL,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages([
        ...conversation,
        { role: "assistant", content: data.response || "(empty reply)", time: timeNow() },
      ]);
      setLlamaUp(true);
    } catch (err) {
      const stopped = err.name === "AbortError";
      setMessages([
        ...conversation,
        {
          role: "assistant",
          content: stopped ? "Stopped." : `Something went wrong: ${err.message}`,
          time: timeNow(),
          error: !stopped,
        },
      ]);
      if (!stopped) setLlamaUp(false);
    } finally {
      setLoading(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    sendText(input);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  }

  function retryLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    sendText(lastUser.content, messages.slice(0, idx));
  }

  const statusText =
    llamaUp === null ? "Connecting…" : llamaUp ? "Online" : "Offline";

  return (
    <div className="app">
      <header className="chat-header">
        <div className="bot-id">
          <div className="avatar bot large">🦙</div>
          <div>
            <h1>Llama Chatbot</h1>
            <button
              type="button"
              className={`status ${llamaUp === null ? "pending" : llamaUp ? "on" : "off"}`}
              onClick={checkHealth}
              title="Click to re-check the connection"
            >
              <span className="dot" />
              {statusText} · {MODEL}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setMessages([])}
          disabled={loading || messages.length === 0}
        >
          New chat
        </button>
      </header>

      <main className="messages">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="avatar bot huge">🦙</div>
            <h2>Hi! How can I help you today?</h2>
            <p>I run locally on your machine through Ollama. Try one of these:</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => sendText(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`row ${m.role}`}>
              {m.role === "assistant" && <div className="avatar bot">🦙</div>}
              <div className="bubble-wrap">
                <div className={`bubble ${m.role}${m.error ? " error" : ""}`}>
                  {m.role === "assistant" ? (
                    <MessageContent text={m.content} />
                  ) : (
                    <div className="text">{m.content}</div>
                  )}
                </div>
                <div className="meta">
                  <span>{m.time}</span>
                  {m.role === "assistant" && !m.error && <CopyButton text={m.content} />}
                  {m.error && i === messages.length - 1 && (
                    <button type="button" className="ghost-btn" onClick={retryLast}>
                      Retry
                    </button>
                  )}
                </div>
              </div>
              {m.role === "user" && <div className="avatar user">You</div>}
            </div>
          ))
        )}

        {loading && (
          <div className="row assistant">
            <div className="avatar bot">🦙</div>
            <div className="bubble assistant">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={onSubmit}>
        <div className="input-box">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Llama…"
            autoFocus
          />
          {loading ? (
            <button
              type="button"
              className="send-btn stop"
              onClick={() => abortRef.current?.abort()}
              title="Stop"
            >
              ■
            </button>
          ) : (
            <button type="submit" className="send-btn" disabled={!input.trim()} title="Send">
              ➤
            </button>
          )}
        </div>
        <div className="hint">Enter to send · Shift+Enter for a new line</div>
      </form>
    </div>
  );
}

export default App;
