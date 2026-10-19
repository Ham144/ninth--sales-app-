import { useEffect, useState } from "react";
import { IntegrationAPI } from "../api/integrationApi";
import { useAuthStore } from "../store/authStore";

export default function ApiKeysPage() {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ projectName: "", appSource: "" });
  const [keys, setKeys] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canManage = user?.description === "IT";

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
    try {
      const res = await IntegrationAPI.generate(form);
      setGenerated(res?.data || null);
      setForm({ projectName: "", appSource: "" });
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

  return (
    <div>
      <header className="page-head">
        <h1>x-api-key management</h1>
        <p>
          Untuk pihak luar / subsidiari yang mengonsumsi backend. Path memakai{" "}
          <code>/api/asThirdParty/...</code> langsung di project ini.
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {generated?.apiKey && (
        <div className="alert ok">
          Key baru: <code>{generated.apiKey}</code> — simpan sekarang, tidak
          ditampilkan ulang.
        </div>
      )}

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Generate key</h2>
        {!canManage && (
          <p style={{ color: "var(--ink-soft)" }}>
            Hanya user dengan description <code>IT</code> yang boleh generate.
            Login hub dulu.
          </p>
        )}
        <form onSubmit={onGenerate}>
          <div className="toolbar">
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label>Project name</label>
              <input
                value={form.projectName}
                onChange={(e) =>
                  setForm((s) => ({ ...s, projectName: e.target.value }))
                }
                disabled={!canManage}
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
                disabled={!canManage}
                required
              />
            </div>
            <button className="btn" type="submit" disabled={!canManage}>
              Generate
            </button>
          </div>
        </form>
      </section>

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
                <th>Status</th>
                <th>Expired</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((item) => (
                <tr key={item._id}>
                  <td>{item.projectName}</td>
                  <td>{item.appSource}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.expiredAt
                      ? new Date(item.expiredAt).toLocaleDateString("id-ID")
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="btn danger"
                      onClick={() => onDelete(item._id)}
                      disabled={!canManage}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {!keys.length && !loading && (
                <tr>
                  <td colSpan={5}>Belum ada data / belum terotorisasi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
