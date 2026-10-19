import { setAuthToken } from "../api/http";
import { Link } from "../lib/router.jsx";

const NAV = [
  { to: "/", label: "Aplikasi" },
  { to: "/updates", label: "Update Fitur" },
  { to: "/docs", label: "How to Use" },
  { to: "/technical", label: "Docs Teknikal" },
  { to: "/keys", label: "x-api-key" },
  { to: "/config", label: "Konfigurasi" },
];

export default function Shell({ children, user, onLogout }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/csi-logo.png" alt="CSI" />
          <div>
            <strong>CSI System Hub - BETA</strong>
            <span>Pusat aplikasi & dokumentasi</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "2rem", padding: "0 0.5rem" }}>
          {user ? (
            <>
              <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                {user.username || user.name || "User"}
                {user.description ? ` · ${user.description}` : ""}
              </div>
              <button
                className="btn secondary"
                style={{ marginTop: "0.6rem", width: "100%" }}
                onClick={() => {
                  setAuthToken(null);
                  onLogout();
                }}
              >
                Keluar
              </button>
            </>
          ) : (
            <Link to="/login" className="btn" style={{ display: "inline-block" }}>
              Masuk hub
            </Link>
          )}
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
