import { useEffect, useRef, useState } from "react";
import { agentJson, chatToken, clearChatToken } from "../api/agentApi";
import { API_BASE } from "../api/http";
import { hubApi } from "../api/hubApi";
import { SalesOrderDraft } from "../components/SalesOrderDraft.jsx";
import { renderReply } from "../lib/renderReply.jsx";
import { navigate } from "../lib/router.jsx";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";

const PROMPTS = [
  "Cari produk kipas angin yang murah berkwalitas",
  "Piutang customer",
  "apa aplikasi pembuat SO",
  "Customer dengan piutang terbesar",
  "tolong cek invoice ini",
  "Apa update terbaru aplikasi CSI super pos",
  "mau mencatat barang masuk dari invoice RIL, pakai aplikasi apa",
  "cara buat promo di app csi super pos",
  "cara menggunakan stok opname gimana",
];

const TOOL_LABEL = {
  search_products: "Mencari produk",
  product_detail: "Membuka detail produk",
  stock_by_location: "Membaca stok per lokasi",
  customer_lookup: "Mencari customer",
  overdue_lookup: "Membaca piutang",
  sales_orders: "Membaca sales order",
  hub_apps: "Mencari aplikasi dan panduan",
  list_locations: "Membuka daftar lokasi",
  search_knowledge: "Membaca panduan internal",
  propose_sales_order: "Menyiapkan draf sales order",
};

const STATUS_LABEL = {
  done: "selesai",
  pending: "pending",
  failed: "gagal",
  cancelled: "batal",
};

function presentReply(text) {
  return String(text || "")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "")
    .replace(/Data ini diperbarui pada\s*\.?\s*/gi, "")
    .replace(/Silakan hubungi lokasi yang sesuai untuk informasi lebih lanjut\.?\s*/gi, "")
    .replace(/\blokasi walk-in\b/gi, "lokasi")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainPreview(text) {
  return presentReply(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .slice(0, 90);
}

function ToolIcon({ name }) {
  const common = {
    viewBox: "0 0 16 16",
    width: "15",
    height: "15",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
  if (name === "search_products" || name === "customer_lookup") {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="4.2" />
        <path d="M10.2 10.2 13 13" />
      </svg>
    );
  }
  if (name === "stock_by_location" || name === "list_locations") {
    return (
      <svg {...common}>
        <path d="M8 1.6 13.2 4.2 8 6.8 2.8 4.2 8 1.6Z" />
        <path d="M2.8 4.2v7.2L8 14.2l5.2-2.8V4.2" />
        <path d="M8 6.8v7.4" />
      </svg>
    );
  }
  if (name === "overdue_lookup" || name === "sales_orders") {
    return (
      <svg {...common}>
        <path d="M4 2.2h6.2L13 5v8.8H4V2.2Z" />
        <path d="M10.2 2.2V5H13" />
        <path d="M6 8.2h5M6 10.6h3.4" />
      </svg>
    );
  }
  if (name === "search_knowledge" || name === "product_detail") {
    return (
      <svg {...common}>
        <path d="M3 2.4h7.2A2.2 2.2 0 0 1 12.4 4.6V14H5.2A2.2 2.2 0 0 1 3 11.8V2.4Z" />
        <path d="M6 5.4h4.2M6 8h4.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M8 5.2v3.1l2 1.2" />
    </svg>
  );
}

function greet(name) {
  const hour = new Date().getHours();
  const hello =
    hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  return name ? `${hello}, ${name}` : hello;
}

function AppGlyph({ app, compact = false }) {
  const letter = (app.title || "?").slice(0, 1).toUpperCase();
  if (app.iconUrl) {
    return <img className={compact ? "app-icon preview" : "app-icon"} src={app.iconUrl} alt="" />;
  }
  return <span className={`app-icon placeholder${compact ? " preview" : ""}`}>{letter}</span>;
}

export default function PlaygroundPage() {
  const user = useAuthStore((state) => state.user);
  const activeId = useChatStore((state) => state.activeId);
  const nonce = useChatStore((state) => state.nonce);
  const [apps, setApps] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [input, setInput] = useState("");
  const [toolsUsed, setToolsUsed] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState("");
  const [modelMode, setModelMode] = useState("pas");
  const [modelModes, setModelModes] = useState([]);
  const [canSelectModel, setCanSelectModel] = useState(false);
  const scroller = useRef(null);
  const abortRef = useRef(null);
  const ignoreNext = useRef(false);
  const turnRef = useRef(0);
  const box = useRef(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      hubApi.listApps().catch(() => ({ data: [] })),
      hubApi.listUpdates().catch(() => ({ data: [] })),
    ]).then(([appRes, updateRes]) => {
      if (cancel) return;
      setApps((appRes?.data || []).filter((app) => app.active !== false && app.url));
      setUpdates(
        (updateRes?.data || []).filter((entry) => !["pending", "failed"].includes(entry.status)).slice(0, 12),
      );
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setModelModes([]);
      setCanSelectModel(false);
      setModelMode("pas");
      return undefined;
    }
    let cancel = false;
    agentJson("/api/v1/agent/model-modes")
      .then((data) => {
        if (cancel) return;
        const modes = (data.modes || []).filter((mode) => mode.available !== false);
        setModelModes(modes);
        setCanSelectModel(Boolean(data.canSelect) && modes.length > 1);
        setModelMode((current) => (modes.some((mode) => mode.id === current) ? current : "pas"));
      })
      .catch(() => {
        if (cancel) return;
        setModelModes([]);
        setCanSelectModel(false);
        setModelMode("pas");
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  useEffect(() => {
    if (ignoreNext.current) {
      ignoreNext.current = false;
      return undefined;
    }
    abortRef.current?.abort();
    turnRef.current += 1;
    setBusy(false);
    if (!activeId) {
      setMessages([]);
      setSessionId("");
      setToolsUsed([]);
      setPinned("");
      setError("");
      return undefined;
    }
    let cancel = false;
    agentJson(`/api/v1/agent/sessions/${activeId}`)
      .then((data) => {
        if (cancel) return;
        setSessionId(String(data.sessionId || activeId));
        setMessages(data.messages || []);
        setModelMode(data.modelMode === "kuat" || data.modelMode === "precise" ? "kuat" : data.modelMode === "hemat" ? "hemat" : "pas");
        setToolsUsed([]);
        setError("");
      })
      .catch((err) => {
        if (!cancel) setError(err.message || "Percakapan tidak bisa dibuka");
      });
    return () => {
      cancel = true;
    };
  }, [activeId, nonce]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, toolsUsed, busy]);

  const sendText = async (raw) => {
    const message = String(raw || "").trim();
    if (!message || busy) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setError("");
    setBusy(true);
    setInput("");
    setToolsUsed([]);
    if (box.current) box.current.style.height = "auto";
    setMessages((rows) => [
      ...rows,
      { role: "user", content: message },
      { role: "assistant", content: "", pending: true },
    ]);
    const turn = ++turnRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let token = await chatToken();
      let response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          context: pinned || undefined,
          sessionId: sessionId || undefined,
          modelMode,
          stream: true,
        }),
      });
      if (response.status === 401) {
        clearChatToken();
        token = await chatToken();
        response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            context: pinned || undefined,
            sessionId: sessionId || undefined,
            modelMode,
            stream: true,
          }),
        });
      }
      if (!response.ok || !response.body) {
        const failed = await response.json().catch(() => ({}));
        throw new Error(failed.message || `HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let draft = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        if (turn !== turnRef.current) return;
        for (const part of parts) {
          const eventName = part.match(/^event: (.+)$/m)?.[1];
          const dataLine = part.match(/^data: (.+)$/m)?.[1];
          if (!dataLine) continue;
          const data = JSON.parse(dataLine);
          if (eventName === "tool") {
            setToolsUsed((names) => [...names, data.name].filter(Boolean));
          }
          if (eventName === "token") {
            draft += data.text || "";
            const snapshot = draft;
            setMessages((rows) => {
              const next = [...rows];
              const last = next[next.length - 1];
              if (last?.role === "assistant" && last.pending) {
                next[next.length - 1] = { role: "assistant", content: snapshot, pending: true };
              } else {
                next.push({ role: "assistant", content: snapshot, pending: true });
              }
              return next;
            });
          }
          if (eventName === "done") {
            const id = String(data.sessionId || "");
            setSessionId(id);
            if (id && useChatStore.getState().activeId !== id) {
              ignoreNext.current = true;
              useChatStore.getState().openSession(id);
            }
            useChatStore.getState().touchList();
            setMessages((rows) => {
              const next = [...rows];
              const last = next[next.length - 1];
              const action = data.action || null;
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  role: "assistant",
                  content: data.reply || last.content,
                  action,
                };
              } else if (data.reply || action) {
                next.push({ role: "assistant", content: data.reply || "", action });
              }
              return next;
            });
          }
          if (eventName === "error") throw new Error(data.message || "Agent gagal");
        }
      }
    } catch (err) {
      if (turn !== turnRef.current) return;
      if (err?.name === "AbortError") {
        setMessages((rows) => {
          const next = [...rows];
          const last = next[next.length - 1];
          if (last?.pending) next[next.length - 1] = { role: "assistant", content: last.content };
          return next;
        });
      } else {
        setError(err.message || "Gagal mengirim pesan");
      }
    } finally {
      if (turn === turnRef.current) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    sendText(input);
  };

  const empty = messages.length === 0;
  const name = user?.name || user?.username || "";

  const openApp = (url) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div className={`chat-app${empty ? " is-empty" : ""}`}>
      {!empty && apps.length > 0 && (
        <div className="app-rail" aria-label="Aplikasi">
          {apps.map((app) => (
            <button key={app.id} type="button" className="app-chip" title={app.description || app.title} onClick={() => openApp(app.url)}>
              <AppGlyph app={app} compact />
              <span>{app.title}</span>
            </button>
          ))}
        </div>
      )}
      <div className={`thread${empty ? "" : " live"}`} ref={scroller}>
        {empty ? (
          <div className="welcome">
            <div className="welcome-hero">
              <img className="welcome-mark" src="/csi-logo.png" alt="" />
              <p className="eyebrow">Copilot internal</p>
              <h1>{greet(name)}</h1>
              <p className="welcome-lead">
                Stok per lokasi, harga Web, customer toko, piutang, dan order terakhir.
              </p>
              <div className="capability-row">
                <span>Stok lokasi</span>
                <span>Harga Web</span>
                <span>Piutang</span>
                <span>Sales order</span>
                <span>Aplikasi internal</span>
              </div>
            </div>
            {apps.length > 0 && (
              <div className="welcome-block">
                <h2>Aplikasi</h2>
                <div className="app-list">
                  {apps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="app-line"
                      onClick={() => openApp(app.url)}
                    >
                      <AppGlyph app={app} compact />
                      <span className="app-line-copy">
                        <strong>{app.title}</strong>
                        <span>{app.description || ""}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {updates.length > 0 && (
              <div className="welcome-block">
                <div className="welcome-label">
                  <h2>Cek update terbaru aplikasi CSI&RIL</h2>
                  <button type="button" className="text-link" onClick={() => navigate("/updates")}>
                    Semua update
                  </button>
                </div>
                <div className="news-list">
                  {updates.map((entry, index) => (
                    <button
                      key={entry.id || entry._id}
                      type="button"
                      className="news-line"
                      onClick={() => navigate("/updates")}
                    >
                      <span className="news-rank">{index + 1}.</span>
                      <strong>{entry.projectTitle}</strong>
                      <span className="news-task">{entry.task}</span>
                      <span className={`news-status status-${entry.status || "pending"}`}>
                        {STATUS_LABEL[entry.status] || entry.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="prompt-row">
              {PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="prompt-chip" onClick={() => sendText(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
          <div className="thread-spacer" />
          <div className="thread-col">
            {messages.map((item, index) => {
              if (item.role === "assistant" && !item.pending && !presentReply(item.content) && !item.action) return null;
              const latestUser = messages.findLastIndex((row) => row.role === "user");
              const showSteps = busy && item.role === "user" && index === latestUser;
              const lastAssistant = messages.findLast((row) => row.role === "assistant");
              const waitingOnTools =
                Boolean(lastAssistant?.pending) && !String(lastAssistant?.content || "").trim();
              const steps = toolsUsed.length ? toolsUsed : ["prepare"];
              return (
                <div key={`${item.role}-${index}`}>
                  <div className={`turn ${item.role}`}>
                    {item.role === "assistant" ? <img className="turn-mark" src="/csi-logo.png" alt="" /> : null}
                    <div
                      className={`chat-bubble ${item.role}${item.pending ? " pending" : ""}${
                        item.role === "assistant" && pinned && presentReply(item.content) === pinned ? " pinned" : ""
                      }`}
                    >
                      {item.role === "assistant" && item.pending && !String(item.content || "").trim() ? (
                        <span className="thinking" aria-label="Menyusun jawaban">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : item.role === "assistant" ? (
                        <>
                          {item.action?.kind === "sales_order_draft"
                            ? null
                            : presentReply(item.content)
                              ? renderReply(presentReply(item.content))
                              : null}
                          {item.action?.kind === "sales_order_draft" ? (
                            <SalesOrderDraft action={item.action} disabled={busy} />
                          ) : null}
                        </>
                      ) : (
                        item.content
                      )}
                      {item.pending && String(item.content || "").trim() ? <span className="caret" /> : null}
                    </div>
                    {item.role === "assistant" && !item.pending ? (
                      <button
                        type="button"
                        className={`pin-side${pinned && presentReply(item.content) === pinned ? " on" : ""}`}
                        aria-pressed={Boolean(pinned && presentReply(item.content) === pinned)}
                        title="Tandai sebagai konteks"
                        onClick={() => {
                          const text = presentReply(item.content);
                          setPinned((current) => (current === text ? "" : text));
                        }}
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                          <path
                            d="M6.2 1.8h3.6l.4 3.2 2.2 1.3v1.4H9.2L8.6 14 7.4 8.7H3.6V7.3l2.2-1.3.4-4.2Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  {showSteps && (
                    <div className="tool-log" aria-live="polite">
                      {steps.map((name, step) => {
                        const active = step === steps.length - 1 && waitingOnTools;
                        const label = name === "prepare" ? "Menyusun jawaban" : TOOL_LABEL[name] || name;
                        return (
                          <div key={`${name}-${step}`} className={`tool-step${active ? " live" : " done"}`}>
                            {active ? <span className="tool-spin" /> : <ToolIcon name={name} />}
                            <span>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
      <div className="composer-dock">
        {error ? <div className="alert error">{error}</div> : null}
        {user ? (
          <form className="composer" onSubmit={onSubmit}>
            {pinned ? (
              <div className="context-chip">
                <span>{plainPreview(pinned)}</span>
                <button type="button" onClick={() => setPinned("")} aria-label="Lepas tanda">
                  ×
                </button>
              </div>
            ) : null}
            {canSelectModel ? (
              <label className="model-mode">
                <span>Mode</span>
                <select
                  value={modelMode}
                  disabled={busy}
                  title={modelModes.find((mode) => mode.id === modelMode)?.description || ""}
                  onChange={(event) => setModelMode(event.target.value)}
                >
                  {modelModes.map((mode) => (
                    <option
                      key={mode.id}
                      value={mode.id}
                      disabled={mode.available === false}
                      title={mode.description}
                    >
                      {mode.model ? `${mode.label} · ${mode.model}` : mode.label}
                    </option>
                  ))}
                </select>
                <em>{modelModes.find((mode) => mode.id === modelMode)?.description || ""}</em>
              </label>
            ) : null}
            <div className="composer-row">
              <textarea
                ref={box}
                rows={1}
                value={input}
                placeholder="Tanya stok, harga Web, piutang, atau order"
                onChange={(event) => {
                  setInput(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendText(input);
                  }
                }}
              />
              {busy ? (
                <button className="send stop" type="button" onClick={() => abortRef.current?.abort()} aria-label="Berhenti">
                  <span />
                </button>
              ) : (
                <button className="send" type="submit" disabled={!input.trim()} aria-label="Kirim">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path
                      d="M8 12.8V3.2M4 7.1 8 3.2l4 3.9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </form>
        ) : (
          <button className="btn composer-login" type="button" onClick={() => navigate("/login")}>
            Masuk untuk bertanya
          </button>
        )}
      </div>
    </div>
  );
}
