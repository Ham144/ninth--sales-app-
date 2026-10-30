import { useEffect, useMemo, useRef, useState } from "react";
import { hubApi } from "../api/hubApi";
import { uploadImage } from "../api/uploadApi";
import { formatDocDate, renderBlogContent } from "../lib/renderBlogContent.jsx";
import { isIT } from "../lib/isIT";
import { navigate, useRoute } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

const TAG_OTHERS = "others";

const emptyDraft = () => ({
  title: "",
  summary: "",
  content: "",
  coverImage: "",
  tags: [],
  appId: null,
  appTitle: null,
  appUrl: null,
  visibility: "internal",
});

export default function BlogDocsPage({
  docType,
  heading,
  description,
  showRag = false,
}) {
  const user = useAuthStore((s) => s.user);
  const canEdit = isIT(user);
  const { search } = useRoute();
  const appFromQuery = useMemo(
    () => new URLSearchParams(search).get("app") || "",
    [search],
  );
  const docFromQuery = useMemo(
    () => new URLSearchParams(search).get("doc") || "",
    [search],
  );

  const [apps, setApps] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState(appFromQuery || "all");
  const [mode, setMode] = useState("list"); // list | view | edit
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fromPdf, setFromPdf] = useState(false);
  const [ragQ, setRagQ] = useState("");
  const [ragHits, setRagHits] = useState([]);
  const contentRef = useRef(null);
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const defaultVisibility = docType === "howto" ? "public" : "internal";

  const tagLabel = (tag) => {
    if (tag === TAG_OTHERS) return "Others";
    const app = apps.find((p) => p.id === tag);
    return app?.title || tag;
  };

  useEffect(() => {
    if (appFromQuery) setTagFilter(appFromQuery);
  }, [appFromQuery]);

  useEffect(() => {
    if (!docFromQuery) return;
    setActiveId(docFromQuery);
    setMode("view");
  }, [docFromQuery]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [docsRes, appsRes] = await Promise.all([
        hubApi.listDocs({ docType }),
        hubApi.listApps(),
      ]);
      setDocs(docsRes?.data || []);
      setApps(appsRes?.data || []);
    } catch (err) {
      setError(err.message || "Gagal memuat artikel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [docType]);

  const appIds = useMemo(() => new Set(apps.map((a) => a.id)), [apps]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return docs.filter((doc) => {
      const tags = doc.tags || [];
      if (tagFilter !== "all") {
        const matchTag =
          tags.includes(tagFilter) ||
          doc.appId === tagFilter ||
          (tagFilter === TAG_OTHERS &&
            (tags.includes(TAG_OTHERS) ||
              (!doc.appId && !tags.some((t) => appIds.has(t)))));
        if (!matchTag) return false;
      }
      if (!term) return true;
      return `${doc.title} ${doc.summary} ${doc.content} ${(doc.tags || []).join(" ")}`
        .toLowerCase()
        .includes(term);
    });
  }, [docs, q, tagFilter, appIds]);

  const active = docs.find((d) => d._id === activeId);

  const requireIT = () => {
    if (canEdit) return true;
    if (!user) {
      setError("Login LDAP diperlukan. Hanya IT yang boleh menulis / mengedit.");
    } else {
      setError("Hanya user dengan description IT yang boleh menulis / mengedit.");
    }
    return false;
  };

  const openView = (id) => {
    setActiveId(id);
    setMode("view");
    setOkMsg("");
  };

  const appPreset = () => {
    const preset =
      tagFilter !== "all" && tagFilter !== TAG_OTHERS
        ? apps.find((p) => p.id === tagFilter)
        : null;
    return {
      tags: preset
        ? [preset.id]
        : tagFilter === TAG_OTHERS
          ? [TAG_OTHERS]
          : [],
      appId: preset?.id || null,
      appTitle: preset?.title || null,
      appUrl: preset?.url || null,
    };
  };

  const openNew = () => {
    if (!requireIT()) return;
    setFromPdf(false);
    setDraft({
      ...emptyDraft(),
      ...appPreset(),
      visibility: defaultVisibility,
    });
    setActiveId(null);
    setMode("edit");
  };

  const openEdit = (doc) => {
    if (!requireIT()) return;
    setDraft({
      title: doc.title || "",
      summary: doc.summary || "",
      content: doc.content || "",
      coverImage: doc.coverImage || "",
      tags: doc.tags?.length ? [...doc.tags] : doc.appId ? [doc.appId] : [],
      appId: doc.appId || null,
      appTitle: doc.appTitle || null,
      appUrl: doc.appUrl || null,
      visibility:
        doc.visibility === "public" || doc.visibility === "internal"
          ? doc.visibility
          : defaultVisibility,
    });
    setFromPdf(false);
    setActiveId(doc._id);
    setMode("edit");
  };

  const syncAppFields = (tags) => {
    const appTag = tags.find((t) => t !== TAG_OTHERS && appIds.has(t));
    const app = apps.find((p) => p.id === appTag);
    return {
      tags,
      appId: app?.id || null,
      appTitle: app?.title || null,
      appUrl: app?.url || null,
    };
  };

  const toggleTag = (tag) => {
    setDraft((prev) => {
      const has = prev.tags.includes(tag);
      const tags = has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag];
      return { ...prev, ...syncAppFields(tags) };
    });
  };

  const insertAtCursor = (snippet) => {
    const el = contentRef.current;
    if (!el) {
      setDraft((d) => ({ ...d, content: `${d.content}\n${snippet}\n` }));
      return;
    }
    const start = el.selectionStart ?? draft.content.length;
    const end = el.selectionEnd ?? start;
    const next =
      draft.content.slice(0, start) + snippet + draft.content.slice(end);
    setDraft((d) => ({ ...d, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleUpload = async (file, { asCover = false } = {}) => {
    if (!requireIT()) return;
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      if (asCover) {
        setDraft((d) => ({ ...d, coverImage: url }));
      } else {
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        insertAtCursor(`\n![${alt}](${url})\n`);
      }
      setOkMsg("Gambar terunggah");
    } catch (err) {
      setError(err.message || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const importPdfFile = async (file, { extra = "" } = {}) => {
    if (!requireIT()) return;
    if (!file) return;
    const name = file.name || "";
    if (file.type && file.type !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
      setError("Hanya file PDF");
      return;
    }
    setImporting(true);
    setError("");
    setOkMsg("");
    try {
      const res = await hubApi.importPdf(file);
      const data = res?.data || {};
      setDraft({
        ...emptyDraft(),
        ...appPreset(),
        title: data.title || "",
        summary: data.summary || "",
        content: data.content || "",
        visibility: defaultVisibility,
      });
      setActiveId(null);
      setFromPdf(true);
      setMode("edit");
      const images = Number(data.imageCount) || 0;
      setOkMsg(
        `Draf siap${images ? ` dengan ${images} gambar` : ""}. Periksa aplikasi dan visibility, lalu simpan.${extra}`,
      );
    } catch (err) {
      setError(err.message || "PDF gagal dibaca");
    } finally {
      setImporting(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!requireIT()) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      setError("Judul dan konten wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        docType,
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        content: draft.content,
        coverImage: draft.coverImage || null,
        tags: draft.tags,
        appId: draft.appId,
        appTitle: draft.appTitle,
        appUrl: draft.appUrl,
        visibility: draft.visibility === "public" ? "public" : "internal",
      };
      let saved;
      if (activeId) {
        const res = await hubApi.updateDoc(activeId, body);
        saved = res.data;
      } else {
        const res = await hubApi.createDoc(body);
        saved = res.data;
      }
      await load();
      setActiveId(saved._id);
      setMode("view");
      setOkMsg("Artikel tersimpan");
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!requireIT() || !activeId) return;
    if (!window.confirm("Hapus artikel ini?")) return;
    try {
      await hubApi.deleteDoc(activeId);
      setMode("list");
      setActiveId(null);
      await load();
      setOkMsg("Artikel dihapus");
    } catch (err) {
      setError(err.message || "Gagal menghapus");
    }
  };

  const runRag = async (e) => {
    e.preventDefault();
    if (!ragQ.trim()) return;
    try {
      const res = await hubApi.ragSearch(ragQ.trim());
      setRagHits(res?.data || []);
    } catch (err) {
      setError(err.message || "RAG search gagal");
    }
  };

  const basePath = docType === "howto" ? "/docs" : "/technical";

  const clearAppFilter = () => {
    setTagFilter("all");
    navigate(basePath);
  };

  const applyTagFilter = (id) => {
    setTagFilter(id);
    navigate(
      id === "all" || id === TAG_OTHERS
        ? basePath
        : `${basePath}?app=${encodeURIComponent(id)}`,
    );
  };

  return (
    <div className="blog-docs">
      <header className="page-head blog-head">
        <div>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {mode === "list" && canEdit && (
          <button className="btn" type="button" onClick={openNew}>
            Tulis artikel
          </button>
        )}
        {mode !== "list" && (
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              setFromPdf(false);
              setMode("list");
            }}
          >
            ← Daftar artikel
          </button>
        )}
      </header>

      {error && <div className="alert error">{error}</div>}
      {okMsg && <div className="alert ok">{okMsg}</div>}

      {showRag && mode === "list" && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <form className="toolbar" onSubmit={runRag}>
            <input
              style={{ flex: 1 }}
              value={ragQ}
              onChange={(e) => setRagQ(e.target.value)}
              placeholder="Uji retrieval RAG…"
            />
            <button className="btn" type="submit">
              Cari knowledge
            </button>
          </form>
          {ragHits.length > 0 && (
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Cuplikan</th>
                  </tr>
                </thead>
                <tbody>
                  {ragHits.map((hit) => (
                    <tr key={hit.id}>
                      <td>{hit.title}</td>
                      <td>{hit.docType}</td>
                      <td>{String(hit.text || "").slice(0, 160)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {mode === "list" && canEdit && (
        <div
          className={`pdf-drop${dragOver ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const files = [...(e.dataTransfer.files || [])];
            const pdf = files.find(
              (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
            );
            if (!pdf) {
              setError("Hanya file PDF");
              return;
            }
            importPdfFile(pdf, {
              extra: files.length > 1 ? " Satu PDF sekali jatuh." : "",
            });
          }}
        >
          <strong>Jatuhkan PDF</strong>
          <p>Satu berkas menjadi satu draf. Periksa aplikasi dan visibility, lalu simpan.</p>
          <button
            className="btn secondary"
            type="button"
            disabled={importing}
            onClick={() => pdfInputRef.current?.click()}
          >
            {importing ? "Membaca PDF…" : "Pilih PDF"}
          </button>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              importPdfFile(file);
            }}
          />
        </div>
      )}

      {mode === "list" && (
        <>
          <div className="blog-filters">
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <label>Cari</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="judul, ringkasan, tag…"
              />
            </div>
          </div>

          <div className="tag-row">
            <button
              type="button"
              className={`chip-btn${tagFilter === "all" ? " active" : ""}`}
              onClick={clearAppFilter}
            >
              Semua
            </button>
            <button
              type="button"
              className={`chip-btn${tagFilter === TAG_OTHERS ? " active" : ""}`}
              onClick={() => applyTagFilter(TAG_OTHERS)}
            >
              Others
            </button>
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                className={`chip-btn${tagFilter === app.id ? " active" : ""}`}
                onClick={() => applyTagFilter(app.id)}
              >
                {app.title}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="panel">Memuat…</div>
          ) : filtered.length === 0 ? (
            <div className="panel">
              Belum ada artikel
              {tagFilter !== "all" ? ` untuk “${tagLabel(tagFilter)}”` : ""}.
              {canEdit && (
                <>
                  {" "}
                  <button className="btn" type="button" onClick={openNew}>
                    Tulis yang pertama
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="blog-list">
              {filtered.map((doc) => (
                <article
                  key={doc._id}
                  className="blog-card"
                  onClick={() => openView(doc._id)}
                >
                  {doc.coverImage ? (
                    <div
                      className="blog-card-cover"
                      style={{ backgroundImage: `url(${doc.coverImage})` }}
                    />
                  ) : (
                    <div className="blog-card-cover placeholder" />
                  )}
                  <div className="blog-card-body">
                    <div className="meta">
                      {(doc.tags || []).map((t) => (
                        <span key={t} className="chip">
                          {tagLabel(t)}
                        </span>
                      ))}
                    </div>
                    <h2>{doc.title}</h2>
                    {doc.summary && <p>{doc.summary}</p>}
                    <time>{formatDocDate(doc.updatedAt || doc.createdAt)}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {mode === "view" && active && (
        <article className="panel blog-article">
          {active.coverImage && (
            <img
              className="blog-cover"
              src={active.coverImage}
              alt=""
            />
          )}
          <div className="meta" style={{ marginBottom: "0.75rem" }}>
            {(active.tags || []).map((t) => (
              <span key={t} className="chip">
                {tagLabel(t)}
              </span>
            ))}
            <span className="chip">
              {active.visibility === "public" ? "Publik" : "Internal"}
            </span>
            <time className="blog-date">
              {formatDocDate(active.updatedAt || active.createdAt)}
            </time>
          </div>
          <h2 className="blog-title">{active.title}</h2>
          {active.summary && <p className="blog-lead">{active.summary}</p>}
          {active.appUrl && (
            <p className="blog-app-link">
              Aplikasi:{" "}
              <a href={active.appUrl} target="_blank" rel="noreferrer">
                {active.appTitle || active.appUrl}
              </a>
            </p>
          )}
          <div className="prose blog-prose">
            {renderBlogContent(active.content)}
          </div>
          <div className="actions" style={{ marginTop: "1.5rem" }}>
            {canEdit && (
              <>
                <button
                  className="btn"
                  type="button"
                  onClick={() => openEdit(active)}
                >
                  Edit
                </button>
                <button className="btn danger" type="button" onClick={remove}>
                  Hapus
                </button>
              </>
            )}
          </div>
        </article>
      )}

      {mode === "edit" && canEdit && (
        <form className="panel blog-editor" onSubmit={save}>
          <div className="field">
            <label>Judul</label>
            <input
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              placeholder="Judul artikel"
              required
            />
          </div>
          <div className="field">
            <label>Ringkasan</label>
            <input
              value={draft.summary}
              onChange={(e) =>
                setDraft((d) => ({ ...d, summary: e.target.value }))
              }
              placeholder="Satu kalimat pembuka"
            />
          </div>

          <div className="field">
            <label>Tag aplikasi / others</label>
            <div className="tag-row">
              <button
                type="button"
                className={`chip-btn${draft.tags.includes(TAG_OTHERS) ? " active" : ""}`}
                onClick={() => toggleTag(TAG_OTHERS)}
              >
                Others
              </button>
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className={`chip-btn${draft.tags.includes(app.id) ? " active" : ""}`}
                  onClick={() => toggleTag(app.id)}
                >
                  {app.title}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Visibility</label>
            <select
              value={draft.visibility === "public" ? "public" : "internal"}
              onChange={(e) =>
                setDraft((d) => ({ ...d, visibility: e.target.value }))
              }
            >
              <option value="public">Publik, boleh dipakai pengunjung</option>
              <option value="internal">Internal saja</option>
            </select>
            {fromPdf && (
              <p className="blog-hint">
                Draf dari PDF. Simpan memakai jalur artikel yang sama.
              </p>
            )}
          </div>

          <div className="field">
            <label>Cover image</label>
            <div className="blog-cover-edit">
              {draft.coverImage ? (
                <img src={draft.coverImage} alt="" />
              ) : (
                <div className="blog-card-cover placeholder short" />
              )}
              <div className="actions">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={uploading}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {uploading ? "Mengunggah…" : "Upload cover"}
                </button>
                {draft.coverImage && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      setDraft((d) => ({ ...d, coverImage: "" }))
                    }
                  >
                    Hapus cover
                  </button>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  handleUpload(file, { asCover: true });
                }}
              />
            </div>
          </div>

          <div className="field">
            <label>Konten (markdown sederhana)</label>
            <div className="blog-toolbar">
              <button
                type="button"
                className="btn secondary"
                disabled={uploading}
                onClick={() => inlineInputRef.current?.click()}
              >
                Sisipkan gambar
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => insertAtCursor("\n## Subjudul\n")}
              >
                Heading
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => insertAtCursor("\n- poin\n")}
              >
                List
              </button>
              <span className="blog-hint">
                Gambar: <code>![alt](url)</code> · heading <code>##</code> ·
                list <code>-</code>
              </span>
              <input
                ref={inlineInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  handleUpload(file, { asCover: false });
                }}
              />
            </div>
            <textarea
              ref={contentRef}
              rows={16}
              value={draft.content}
              onChange={(e) =>
                setDraft((d) => ({ ...d, content: e.target.value }))
              }
              placeholder={"# Cara pakai\n\nTulis langkah di sini…\n\n![screenshot](url)\n"}
              required
            />
          </div>

          {draft.content.trim() && (
            <div className="blog-preview panel">
              <h3>Preview</h3>
              <div className="prose blog-prose">
                {renderBlogContent(draft.content)}
              </div>
            </div>
          )}

          <div className="actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setMode(activeId ? "view" : "list")}
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
