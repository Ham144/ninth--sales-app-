import { useEffect, useState } from "react";
import { clearChatToken, agentJson } from "../api/agentApi";
import { setAuthToken } from "../api/http";
import { Link, navigate, useRoute } from "../lib/router.jsx";
import { useChatStore } from "../store/chatStore";

const EXTRAS = [
  { to: "/apps", label: "Aplikasi" },
  { to: "/updates", label: "Update fitur" },
  { to: "/docs", label: "How to use" },
  { to: "/technical", label: "Docs teknikal" },
  { to: "/agent/config", label: "Pengaturan agent" },
  { to: "/keys", label: "x-api-key" },
  { to: "/config", label: "Konfigurasi SOAP" },
];

function isExtra(path) {
  return EXTRAS.some((item) => path === item.to || path.startsWith(`${item.to}/`));
}

export default function Shell({ children, user, onLogout, chat = false }) {
  const { path } = useRoute();
  const sessions = useChatStore((state) => state.sessions);
  const activeId = useChatStore((state) => state.activeId);
  const listVersion = useChatStore((state) => state.listVersion);
  const setSessions = useChatStore((state) => state.setSessions);
  const openSession = useChatStore((state) => state.openSession);
  const newChat = useChatStore((state) => state.newChat);
  const [extrasOpen, setExtrasOpen] = useState(() => isExtra(path));
  const [navOpen, setNavOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (isExtra(path)) setExtrasOpen(true);
    setNavOpen(false);
  }, [path]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return undefined;
    }
    let cancel = false;
    agentJson("/api/v1/agent/sessions")
      .then((data) => {
        if (!cancel) setSessions(data.sessions || []);
      })
      .catch(() => {
        if (!cancel) setSessions([]);
      });
    return () => {
      cancel = true;
    };
  }, [user, listVersion, setSessions]);

  const startNew = () => {
    newChat();
    setNavOpen(false);
    navigate("/");
  };

  const openExisting = (sessionId) => {
    openSession(sessionId);
    setNavOpen(false);
    navigate("/");
  };

  return (
    <div className={`app-shell${chat ? " is-chat" : ""}${navOpen ? " nav-open" : ""}`}>
      <button type="button" className="rail-backdrop" aria-label="Tutup menu" onClick={() => setNavOpen(false)} />
      <aside className={`rail${navOpen ? " open" : ""}`} id="app-rail" inert={narrow && !navOpen ? true : undefined}>
        <button type="button" className="brand brand-btn" onClick={startNew}>
          <img src="/csi-logo.png" alt="" />
          <div>
            <strong>AI Agent MIDCSI</strong>
            <span>Copilot internal</span>
          </div>
        </button>
        <button type="button" className="new-chat" onClick={startNew}>
          <span aria-hidden="true">+</span>
          Percakapan baru
        </button>
        <div className="history ">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              type="button"
              className={activeId === String(session.sessionId) ? "active" : ""}
              title={session.title}
              onClick={() => openExisting(String(session.sessionId))}
            >
              <span className="history-title">{session.title}</span>
            </button>
          ))}
          {user && !sessions.length ? (
            <p className="history-empty">Belum ada percakapan.</p>
          ) : null}
        </div>

        <div className="rail-foot">
          <button
            type="button"
            className={`extras-toggle${extrasOpen ? " open" : ""}`}
            onClick={() => setExtrasOpen((open) => !open)}
          >
            Lainnya
          </button>
          {extrasOpen ? (
            <nav className="extras">
              {EXTRAS.map((item) => (
                <Link key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {user ? (
            <div className="who">
              <div>
                {user.username || user.name || "User"}
                {user.description ? ` · ${user.description}` : ""}
              </div>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  clearChatToken();
                  setAuthToken(null);
                  onLogout();
                }}
              >
                Keluar
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn">
              Masuk
            </Link>
          )}
        </div>
        
      </aside>
      <div className="shell-main">
        <header className="mobile-bar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Buka menu"
            aria-expanded={navOpen}
            aria-controls="app-rail"
            onClick={() => setNavOpen(true)}
          >
            <span className="menu-glyph" />
          </button>
          <strong>CSI BOT</strong>
          <button type="button" className="icon-btn" aria-label="Percakapan baru" onClick={startNew}>
            +
          </button>
        </header>
        <main className={chat ? "stage chat" : "stage pad"}>{children}</main>
      </div>
    </div>
  );
}
