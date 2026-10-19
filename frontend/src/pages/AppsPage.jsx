import { useEffect, useMemo, useState } from "react";
import { hubApi } from "../api/hubApi";
import { isIT } from "../lib/isIT";
import { navigate } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

function openApp(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

const emptyForm = () => ({
  id: "",
  title: "",
  description: "",
  url: "",
  iconUrl: "",
  authRequired: true,
  sortOrder: 0,
  active: true,
});

export default function AppsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = isIT(user);
  const [apps, setApps] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [editor, setEditor] = useState(null); // null | 'new' | app.id
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await hubApi.listApps({ all: canEdit });
      setApps(res?.data || []);
    } catch (err) {
      setError(err.message || "Gagal memuat aplikasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [canEdit]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return apps
      .filter((p) => {
        if (!canEdit && p.active === false) return false;
        if (!term) return true;
        return `${p.title} ${p.description} ${p.id}`
          .toLowerCase()
          .includes(term);
      })
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.title.localeCompare(b.title),
      );
  }, [apps, q, canEdit]);

  const openNew = () => {
    if (!canEdit) return;
    setForm(emptyForm());
    setEditor("new");
    setOkMsg("");
  };

  const openEdit = (app) => {
    if (!canEdit) return;
    setForm({
      id: app.id,
      title: app.title || "",
      description: app.description || "",
      url: app.url || "",
      iconUrl: app.iconUrl || "",
      authRequired: app.authRequired !== false,
      sortOrder: app.sortOrder ?? 0,
      active: app.active !== false,
    });
    setEditor(app.id);
    setOkMsg("");
  };

  const closeEditor = () => {
    setEditor(null);
    setForm(emptyForm());
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.title.trim() || !form.url.trim()) {
      setError("Title dan URL wajib");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        id: form.id.trim() || undefined,
        title: form.title.trim(),
        description: form.description.trim(),
        url: form.url.trim(),
        iconUrl: form.iconUrl.trim() || null,
        authRequired: Boolean(form.authRequired),
        sortOrder: Number(form.sortOrder) || 0,
        active: Boolean(form.active),
      };
      if (editor === "new") {
        await hubApi.createApp(body);
      } else {
        await hubApi.updateApp(editor, body);
      }
      closeEditor();
      setOkMsg("Aplikasi tersimpan");
      await load();
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (app) => {
    if (!canEdit) return;
    if (!window.confirm(`Hapus aplikasi “${app.title}”?`)) return;
    try {
      await hubApi.deleteApp(app.id);
      setOkMsg("Aplikasi dihapus");
      if (editor === app.id) closeEditor();
      await load();
    } catch (err) {
      setError(err.message || "Gagal menghapus");
    }
  };

  return (
    <div>
      <header className="page-head blog-head">
        <div>
          <h1>Tempat berkumpul aplikasi</h1>
          <p>
            Buka di tab baru — login ditangani aplikasi sendiri.{" "}
            {canEdit
              ? "Kamu IT: bisa menambah / mengedit daftar app."
              : "Daftar dikelola IT."}
          </p>
        </div>
        {canEdit && (
          <button className="btn" type="button" onClick={openNew}>
            Tambah aplikasi
          </button>
        )}
      </header>

      {error && <div className="alert error">{error}</div>}
      {okMsg && <div className="alert ok">{okMsg}</div>}

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Cari aplikasi</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="invoice, s-bit, antrian..."
          />
        </div>
      </section>

      {loading ? (
        <div className="panel">Memuat…</div>
      ) : (
        <div className="grid-apps">
          {list.map((app) => (
            <article
              key={app.id}
              className={`app-card${app.active === false ? " inactive" : ""}`}
            >
              <div className="app-card-top">
                {app.iconUrl ? (
                  <img
                    className="app-icon"
                    src={app.iconUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="app-icon placeholder" aria-hidden>
                    {(app.title || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="app-card-title">
                  <h3>{app.title}</h3>
                  {app.active === false && (
                    <span className="chip">nonaktif</span>
                  )}
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  color: "var(--ink-soft)",
                  fontSize: "0.92rem",
                }}
              >
                {app.description}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--ink-soft)",
                  wordBreak: "break-all",
                }}
              >
                {app.url}
              </p>
              <div className="actions">
                {app.authRequired !== false ? (
                  <>
                    <button className="btn" onClick={() => openApp(app.url)}>
                      Login
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => openApp(app.url)}
                    >
                      Sudah login
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => openApp(app.url)}>
                    Buka
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() =>
                    navigate(`/docs?app=${encodeURIComponent(app.id)}`)
                  }
                >
                  How to use
                </button>
                <button
                  className="btn ghost"
                  onClick={() =>
                    navigate(`/technical?app=${encodeURIComponent(app.id)}`)
                  }
                >
                  Docs teknikal
                </button>
                {canEdit && (
                  <>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => openEdit(app)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn danger"
                      type="button"
                      onClick={() => remove(app)}
                    >
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && canEdit && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div
            className="modal modal-wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 style={{ marginBottom: "0.35rem" }}>
              {editor === "new" ? "Tambah aplikasi" : "Edit aplikasi"}
            </h2>
            <form onSubmit={save}>
              {editor === "new" && (
                <div className="field">
                  <label>ID / slug (opsional)</label>
                  <input
                    value={form.id}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, id: e.target.value }))
                    }
                    placeholder="auto dari title jika kosong"
                  />
                </div>
              )}
              <div className="field">
                <label>Title</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, description: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>URL</label>
                <input
                  value={form.url}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, url: e.target.value }))
                  }
                  placeholder="http://..."
                  required
                />
              </div>
              <div className="field">
                <label>Icon URL</label>
                <input
                  value={form.iconUrl}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, iconUrl: e.target.value }))
                  }
                  placeholder="https://.../icon.png"
                />
                {form.iconUrl && (
                  <img
                    className="app-icon preview"
                    src={form.iconUrl}
                    alt=""
                    style={{ marginTop: "0.5rem" }}
                  />
                )}
              </div>
              <div className="field">
                <label>Sort order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      sortOrder: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.authRequired}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      authRequired: e.target.checked,
                    }))
                  }
                />
                Butuh login (tampilkan tombol Login + Sudah login)
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, active: e.target.checked }))
                  }
                />
                Aktif (tampil di daftar publik)
              </label>
              <div className="actions" style={{ marginTop: "1rem" }}>
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={closeEditor}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
