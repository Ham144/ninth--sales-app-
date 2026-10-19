import { useEffect, useMemo, useState } from "react";
import { hubApi } from "../api/hubApi";
import { parseBulkUpdates } from "../lib/parseBulkUpdates";
import { isIT } from "../lib/isIT";
import { useAuthStore } from "../store/authStore";
import { navigate } from "../lib/router.jsx";

const EXAMPLE = `[x] stok-opname: LIVE di .26
[x] pos: fix sync spg
[cancel] s-bit: config auto release di s-bit untuk KAO
[fail] pos: item isDisabled harusnya tidak muncul di mobile
[] s-bit: pindahin upload foto s-bit ke service n8n upload image`;

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UpdatesPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = isIT(user);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [draft, setDraft] = useState({
    projectTitle: "",
    task: "",
    status: "pending",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await hubApi.listUpdates({ search, status });
      setEntries(res?.data || []);
    } catch (err) {
      setError(err.message || "Gagal memuat updates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) =>
      `${e.projectTitle} ${e.task} ${e.completedBy || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [entries, search]);

  const requireIT = () => {
    if (canEdit) return true;
    if (!user) {
      setError("Login LDAP diperlukan. Hanya IT yang boleh menambah/ubah update.");
    } else {
      setError("Hanya user dengan description IT yang boleh menambah/ubah update.");
    }
    return false;
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!requireIT()) return;
    if (!draft.projectTitle.trim() || !draft.task.trim()) return;
    try {
      await hubApi.createUpdate(draft);
      setDraft({ projectTitle: "", task: "", status: "pending" });
      await load();
    } catch (err) {
      setError(err.message || "Gagal menambah");
    }
  };

  const setEntryStatus = async (id, nextStatus) => {
    if (!requireIT()) return;
    try {
      await hubApi.patchUpdate(id, { status: nextStatus });
      await load();
    } catch (err) {
      setError(err.message || "Gagal update status");
    }
  };

  const previewBulk = () => {
    const { parsed, errors } = parseBulkUpdates(bulkText);
    setBulkErrors(errors);
    setBulkPreview(parsed);
  };

  const importBulk = async () => {
    if (!requireIT()) return;
    if (!bulkPreview?.length) return;
    try {
      await hubApi.bulkUpdates(bulkPreview);
      setBulkText("");
      setBulkPreview(null);
      setBulkErrors([]);
      await load();
    } catch (err) {
      setError(err.message || "Gagal import");
    }
  };

  return (
    <div>
      <header className="page-head">
        <h1>Update fitur pusat</h1>
        <p>
          Changelog di database (MongoDB). Format bulk:{" "}
          <code>[x] project: task</code>. Siap diindeks untuk RAG nanti.
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {!canEdit && (
        <div className="alert">
          Baca bebas. Menulis update hanya untuk IT.
          {!user && (
            <>
              {" "}
              <button
                className="btn secondary"
                onClick={() => navigate("/login")}
              >
                login LDAP
              </button>
            </>
          )}
        </div>
      )}

      {canEdit && (
        <>
          <section className="panel" style={{ marginBottom: "1rem" }}>
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Import masal</h2>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setBulkText(EXAMPLE)}
              >
                Muat contoh
              </button>
            </div>
            <div className="field">
              <label>Baris update</label>
              <textarea
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="[x] project: task description"
                style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
              />
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn secondary"
                onClick={previewBulk}
              >
                Preview
              </button>
              {bulkPreview?.length > 0 && (
                <button type="button" className="btn" onClick={importBulk}>
                  Import {bulkPreview.length} baris
                </button>
              )}
            </div>
            {bulkErrors.length > 0 && (
              <div className="alert error" style={{ marginTop: "0.75rem" }}>
                {bulkErrors.map((err) => (
                  <div key={`${err.lineNumber}-${err.message}`}>
                    Baris {err.lineNumber}: {err.message}
                  </div>
                ))}
              </div>
            )}
            {bulkPreview?.length > 0 && (
              <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Project</th>
                      <th>Task</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.map((row) => (
                      <tr key={`${row.lineNumber}-${row.task}`}>
                        <td>{row.lineNumber}</td>
                        <td>{row.projectRaw}</td>
                        <td>{row.task}</td>
                        <td className={`status-${row.status}`}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <form
              onSubmit={addEntry}
              className="toolbar"
              style={{ alignItems: "end" }}
            >
              <div
                className="field"
                style={{ flex: 1, minWidth: 140, margin: 0 }}
              >
                <label>Project</label>
                <input
                  value={draft.projectTitle}
                  onChange={(e) =>
                    setDraft((s) => ({ ...s, projectTitle: e.target.value }))
                  }
                  placeholder="s-bit"
                />
              </div>
              <div
                className="field"
                style={{ flex: 2, minWidth: 200, margin: 0 }}
              >
                <label>Task / update</label>
                <input
                  value={draft.task}
                  onChange={(e) =>
                    setDraft((s) => ({ ...s, task: e.target.value }))
                  }
                  placeholder="apa yang berubah"
                />
              </div>
              <div className="field" style={{ width: 140, margin: 0 }}>
                <label>Status</label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((s) => ({ ...s, status: e.target.value }))
                  }
                >
                  <option value="pending">pending</option>
                  <option value="done">done</option>
                  <option value="failed">failed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <button className="btn" type="submit">
                Tambah
              </button>
            </form>
          </section>
        </>
      )}

      <section className="panel">
        <div className="toolbar">
          <input
            style={{ flex: 1, minWidth: 180 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="cari project / task"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">semua status</option>
            <option value="pending">pending</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button className="btn secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p>Memuat...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Project</th>
                  <th>Update</th>
                  <th>Status</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item._id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.projectTitle}</td>
                    <td>{item.task}</td>
                    <td className={`status-${item.status}`}>{item.status}</td>
                    {canEdit && (
                      <td>
                        {item.status !== "done" && (
                          <button
                            className="btn secondary"
                            onClick={() => setEntryStatus(item._id, "done")}
                          >
                            Mark done
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
