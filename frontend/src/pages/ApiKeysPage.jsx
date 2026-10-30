import { useEffect, useState } from "react";
import { IntegrationAPI } from "../api/integrationApi";
import { isIT } from "../lib/isIT";
import { navigate } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

export default function ApiKeysPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = isIT(user);
  const [form, setForm] = useState({
    projectName: "",
    appSource: "",
    scope: "full",
  });
  const [keys, setKeys] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await IntegrationAPI.list();
      setKeys(res?.data || []);
    } catch (err) {
      setError(err.message || "Gagal memuat API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onGenerate = async (e) => {
    e.preventDefault();
    setError("");
    setCopied(false);
    try {
      const res = await IntegrationAPI.generate(form);
      setGenerated(res?.data || null);
      setForm({ projectName: "", appSource: "", scope: "full" });
      await load();
    } catch (err) {
      setError(err.message || "Gagal generate key");
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Hapus API key ini?")) return;
    try {
      await IntegrationAPI.delete(id);
      await load();
    } catch (err) {
      setError(err.message || "Gagal hapus key");
    }
  };

  const copyKey = async () => {
    if (!generated?.apiKey) return;
    try {
      await navigator.clipboard.writeText(generated.apiKey);
      setCopied(true);
    } catch {
      setError("Gagal copy ke clipboard");
    }
  };

  return (
    <div>
      <header className="page-head">
        <h1>x-api-key</h1>
        <p>
          Untuk pihak luar / subsidiari yang mengonsumsi backend. Path memakai{" "}
          <code>/api/asThirdParty/...</code>.
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {generated?.apiKey && (
        <div className="alert ok key-alert">
          <div>
            Key baru (simpan sekarang, tidak ditampilkan ulang):
            <br />
            <code className="key-value">{generated.apiKey}</code>
          </div>
          <button type="button" className="btn secondary" onClick={copyKey}>
            {copied ? "Tersalin" : "Copy"}
          </button>
        </div>
      )}

      {canManage ? (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Generate key</h2>
          <form onSubmit={onGenerate}>
            <div className="toolbar">
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <label>Project name</label>
                <input
                  value={form.projectName}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, projectName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <label>App source</label>
                <input
                  value={form.appSource}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, appSource: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <label>Scope</label>
                <select
                  value={form.scope}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, scope: e.target.value }))
                  }
                >
                  <option value="full">Full (integrasi yang sudah ada)</option>
                  <option value="public-catalog">
                    Katalog publik (chatbot B2C)
                  </option>
                </select>
              </div>
              <button className="btn" type="submit">
                Generate
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="alert" style={{ marginBottom: "1rem" }}>
          Hanya user IT yang boleh generate / hapus key.
          {!user && (
            <>
              {" "}
              <button
                type="button"
                className="btn secondary"
                onClick={() => navigate("/login")}
              >
                Masuk hub
              </button>
            </>
          )}
        </div>
      )}

      <section className="panel">
        <div className="toolbar">
          <h2 style={{ margin: 0, flex: 1 }}>Daftar key</h2>
          <button className="btn secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Source</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Expired</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {keys.map((item) => (
                <tr key={item._id}>
                  <td>{item.projectName}</td>
                  <td>{item.appSource}</td>
                  <td>{item.scope || "full"}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.expiredAt
                      ? new Date(item.expiredAt).toLocaleDateString("id-ID")
                      : "—"}
                  </td>
                  {canManage && (
                    <td>
                      <button
                        className="btn danger"
                        onClick={() => onDelete(item._id)}
                      >
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!keys.length && !loading && (
                <tr>
                  <td colSpan={canManage ? 6 : 5}>
                    Belum ada data / belum terotorisasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
