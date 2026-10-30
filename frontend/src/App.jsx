import Shell from "./components/Shell";
import { navigate, useRoute } from "./lib/router.jsx";
import AppsPage from "./pages/AppsPage";
import UpdatesPage from "./pages/UpdatesPage";
import DocsPage from "./pages/DocsPage";
import TechnicalPage from "./pages/TechnicalPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import ConfigPage from "./pages/ConfigPage";
import LoginPage from "./pages/LoginPage";
import PlaygroundPage from "./pages/PlaygroundPage";
import AgentConfigPage from "./pages/AgentConfigPage";
import AgentDocsPage from "./pages/AgentDocsPage";
import { useAuthStore } from "./store/authStore";

function RequireAuth({ user, children }) {
  if (user) return children;
  return (
    <div className="panel">
      <h2>Perlu masuk hub</h2>
      <p style={{ color: "var(--ink-soft)" }}>
        Halaman ini memakai API backend yang butuh session. Login LDAP dulu.
      </p>
      <button className="btn" onClick={() => navigate("/login")}>
        Ke halaman login
      </button>
    </div>
  );
}

function RouteView({ path, user }) {
  if (path.startsWith("/updates")) return <UpdatesPage />;
  if (path.startsWith("/docs")) return <DocsPage />;
  if (path.startsWith("/technical")) return <TechnicalPage />;
  if (path.startsWith("/keys")) {
    return (
      <RequireAuth user={user}>
        <ApiKeysPage />
      </RequireAuth>
    );
  }
  if (path.startsWith("/config")) {
    return (
      <RequireAuth user={user}>
        <ConfigPage />
      </RequireAuth>
    );
  }
  if (path.startsWith("/login")) return <LoginPage />;
  if (path.startsWith("/apps")) return <AppsPage />;
  if (path.startsWith("/agent/config")) {
    return (
      <RequireAuth user={user}>
        <AgentConfigPage />
      </RequireAuth>
    );
  }
  if (path === "/" || path === "/agent" || path.startsWith("/playground")) {
    return <PlaygroundPage />;
  }
  if (path.startsWith("/agent-docs")) return <AgentDocsPage />;
  return <PlaygroundPage />;
}

export default function App() {
  const { path } = useRoute();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  if (path.startsWith("/login")) {
    return <RouteView path={path} user={user} />;
  }

  const chat = path === "/" || path === "/agent" || path.startsWith("/playground");

  return (
    <Shell user={user} onLogout={clearSession} chat={chat}>
      <RouteView path={path} user={user} />
    </Shell>
  );
}
