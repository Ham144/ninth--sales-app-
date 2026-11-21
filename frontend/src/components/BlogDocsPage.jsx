import { useEffect, useMemo, useRef, useState } from "react";
import { hubApi } from "../api/hubApi";
import { uploadImage } from "../api/uploadApi";
import { formatDocDate, renderBlogContent } from "../lib/renderBlogContent.jsx";
import {
  clipboardHasImages,
  clipboardToMarkdown,
  filesToImageMarkdown,
} from "../lib/pasteRich.js";
import {
  IMPORT_ACCEPT,
  KNOWLEDGE_RULES,
  MAX_KNOWLEDGE_CONTENT_CHARS,
  TAG_OTHERS,
  collectCustomCategories,
  formatTagLabel,
  isBlockedSpreadsheet,
  isKnowledgeImportFile,
  slugifyTag,
  suggestKnowledgeTags,
  validateImportFile,
  validateKnowledgeDraft,
} from "../lib/knowledgeRules.js";
import { isIT } from "../lib/isIT";
import { navigate, useRoute } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

const isImportFile = isKnowledgeImportFile;

function isImageFile(file) {
  return (
    String(file?.type || "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(file?.name || "")
  );
}

function draftFromPastedText(text) {
  const trimmed = String(text || "").replace(/\u0000/g, "").trim();
  if (!trimmed) return null;
  const first = trimmed
    .split("\n")
    .map((row) => row.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  const title = (first || "Catatan tempel").slice(0, 140);
  const line = trimmed
    .split("\n")
    .map((row) => row.replace(/^#+\s*/, "").trim())
    .find((row) => row && row !== title);
  const summary = !line
    ? ""
    : line.length <= 180
      ? line
      : `${line.slice(0, 180).trim()}…`;
  return { title, summary, content: trimmed };
}

const emptyDraft = (docType = "howto") => ({
  title: "",
  summary: "",
  content: "",
  coverImage: "",
  tags: [],
  appId: null,
  appTitle: null,
  appUrl: null,
  docType: docType === "technical" ? "technical" : "howto",
  visibility: docType === "howto" ? "public" : "internal",
});

function aiRoleLabel(docType) {
  return docType === "technical" ? "Teknikal" : "How to use";
}

export default function BlogDocsPage({
  heading,
  description,
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
  const aiFromQuery = useMemo(() => {
    const value = new URLSearchParams(search).get("ai");
    return value === "technical" || value === "howto" ? value : "";
  }, [search]);

  const [apps, setApps] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState(appFromQuery || "all");
  const [aiFilter, setAiFilter] = useState(aiFromQuery || "all");
  const [mode, setMode] = useState("list"); // list | view | edit
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fromImport, setFromImport] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showCover, setShowCover] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");
  const contentRef = useRef(null);
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const defaultAiRole = aiFilter === "technical" ? "technical" : "howto";
  const contentLen = String(draft.content || "").length;

  const tagLabel = (tag) => formatTagLabel(tag, apps);

  useEffect(() => {
    if (appFromQuery) setTagFilter(appFromQuery);
  }, [appFromQuery]);

  useEffect(() => {
    setAiFilter(aiFromQuery || "all");
  }, [aiFromQuery]);

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
        hubApi.listDocs({}),
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
  }, []);

  const appIds = useMemo(() => new Set(apps.map((a) => a.id)), [apps]);
  const customCategories = useMemo(
    () => collectCustomCategories(docs, apps),
    [docs, apps],
  );
  const draftCustomTags = useMemo(
    () => (draft.tags || []).filter((tag) => tag !== TAG_OTHERS && !appIds.has(tag)),
    [draft.tags, appIds],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return docs.filter((doc) => {
      const tags = doc.tags || [];
      if (aiFilter === "howto" || aiFilter === "technical") {
        if (doc.docType !== aiFilter) return false;
      }
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
  }, [docs, q, tagFilter, aiFilter, appIds]);
  
  const active = docs.find((d) => d._id ===  activeId);

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

  const openEdit = (doc) => {
    if (!requireIT()) return;
    const docType = doc.docType === "technical" ? "technical" : "howto";
    setDraft({
      title: doc.title || "",
      summary: doc.summary || "",
      content: doc.content || "",
      coverImage: doc.coverImage || "",
      tags: doc.tags?.length ? [...doc.tags] : doc.appId ? [doc.appId] : [],
      appId: doc.appId || null,
      appTitle: doc.appTitle || null,
      appUrl: doc.appUrl || null,
      docType,
      visibility:
        doc.visibility === "public" || doc.visibility === "internal"
          ? doc.visibility
          : docType === "howto"
            ? "public"
            : "internal",
    });
    setFromImport(false);
    setActiveId(doc._id);
    setMode("edit");
  };

  const syncAppFields = (tags) => {
    const appTag = tags.find((t) => t !== TAG_OTHERS && appIds.has(t));
    const app = apps.find((p) => p.id === appTag);
    const hasAppOrOthers = Boolean(appTag) || tags.includes(TAG_OTHERS);
    return {
      tags: hasAppOrOthers ? tags : [...tags, TAG_OTHERS],
      appId: app?.id || null,
      appTitle: app?.title || null,
      appUrl: app?.url || null,
    };
  };

  /** App / Others: single selection. Custom categories stay. */
  const setAppCategory = (tag) => {
    setDraft((prev) => {
      const custom = prev.tags.filter((t) => t !== TAG_OTHERS && !appIds.has(t));
      if (tag === TAG_OTHERS) {
        return {
          ...prev,
          tags: [...custom, TAG_OTHERS],
          appId: null,
          appTitle: null,
          appUrl: null,
        };
      }
      const app = apps.find((p) => p.id === tag);
      return {
        ...prev,
        tags: [...custom, tag],
        appId: app?.id || null,
        appTitle: app?.title || null,
        appUrl: app?.url || null,
      };
    });
  };

  const toggleCustomTag = (tag) => {
    const slug = slugifyTag(tag);
    if (!slug || slug === TAG_OTHERS || appIds.has(slug)) return;
    setDraft((prev) => {
      const has = prev.tags.includes(slug);
      const tags = has
        ? prev.tags.filter((t) => t !== slug)
        : [...prev.tags, slug];
      return { ...prev, ...syncAppFields(tags) };
    });
  };

  const addCustomTagFromInput = () => {
    const slug = slugifyTag(customTagInput);
    if (!slug) {
      setError("Kategori custom kosong / tidak valid");
      return;
    }
    if (slug === TAG_OTHERS || appIds.has(slug)) {
      setAppCategory(slug === TAG_OTHERS ? TAG_OTHERS : slug);
      setCustomTagInput("");
      return;
    }
    setDraft((prev) => {
      if (prev.tags.includes(slug)) return prev;
      return { ...prev, ...syncAppFields([...prev.tags, slug]) };
    });
    setCustomTagInput("");
    setError("");
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

  const openImportedDraft = (data, { extra = "", sourceLabel = "berkas" } = {}) => {
    const preset = appPreset();
    const suggested = suggestKnowledgeTags({
      apps,
      fileName: data.fileName || "",
      title: data.title || "",
      summary: data.summary || "",
      content: data.content || "",
      presetAppId: preset.appId || null,
    });
    const looksLikeTable =
      /\|.+\|/.test(String(data.content || "")) ||
      String(data.fileName || "")
        .toLowerCase()
        .endsWith(".csv");
    // CSV / tables need more RAG rows → technical cuplikan budget.
    const importDocType = looksLikeTable ? "technical" : defaultAiRole;
    const matches = (docs || []).filter((doc) => {
      const title = String(doc.title || "")
        .trim()
        .toLowerCase();
      const incoming = String(data.title || "")
        .trim()
        .toLowerCase();
      return title && incoming && title === incoming;
    });
    const replaceId = matches.length === 1 ? matches[0]._id : null;
    setDraft({
      ...emptyDraft(importDocType),
      tags: suggested.tags,
      appId: suggested.appId,
      appTitle: suggested.appTitle,
      appUrl: suggested.appUrl,
      title: data.title || "",
      summary: data.summary || "",
      content: data.content || "",
      docType: importDocType,
      visibility: importDocType === "howto" ? "public" : "internal",
    });
    setActiveId(replaceId || null);
    setFromImport(true);
    setShowCover(false);
    setCustomTagInput("");
    setMode("edit");
    const images = Number(data.imageCount) || 0;
    const warn = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
    const tagPreview = suggested.tags.map((tag) => tagLabel(tag)).join(", ");
    const replaceNote = replaceId
      ? ` Judul sama dengan knowledge yang ada — Simpan akan **mengganti** dokumen lama (bukan dobel).`
      : matches.length > 1
        ? ` Ada beberapa knowledge berjudul sama — pilih yang benar di daftar atau ganti judul.`
        : "";
    const notes = [
      `Draf siap${images ? ` dengan ${images} gambar` : ""} dari ${sourceLabel}. Kategori otomatis: ${tagPreview}. Boleh dibetulkan sebelum simpan.${replaceNote}${extra}`,
      ...warn,
    ];
    setError("");
    setOkMsg(notes.join(" "));
  };

  const importDocumentFile = async (file, { extra = "" } = {}) => {
    if (!requireIT()) return;
    if (!file) return;
    const blocked = validateImportFile(file);
    if (blocked) {
      setError(blocked);
      return;
    }
    setImporting(true);
    setError("");
    setOkMsg("");
    try {
      const res = await hubApi.importDocument(file);
      openImportedDraft(
        { ...(res?.data || {}), fileName: file.name },
        { extra, sourceLabel: "berkas" },
      );
    } catch (err) {
      setError(err.message || "Berkas gagal dibaca");
    } finally {
      setImporting(false);
    }
  };

  const applyPastedText = (raw, { imageCount = 0 } = {}) => {
    if (!requireIT()) return;
    const data = draftFromPastedText(raw);
    if (!data) {
      setError("Tempel teks dulu");
      return;
    }
    if (data.content.length > MAX_KNOWLEDGE_CONTENT_CHARS) {
      setError(
        `Teks terlalu panjang (${data.content.length.toLocaleString("id-ID")} karakter). Batas ${MAX_KNOWLEDGE_CONTENT_CHARS.toLocaleString("id-ID")} — pecah topik, jangan dump massal.`,
      );
      return;
    }
    setError("");
    setPasteText("");
    openImportedDraft({ ...data, imageCount }, { sourceLabel: "teks" });
  };

  const applyPastedClipboard = async (clipboardData) => {
    if (!requireIT()) return;
    setImporting(true);
    setError("");
    setOkMsg("");
    try {
      const { markdown, imageCount } = await clipboardToMarkdown(clipboardData, {
        upload: uploadImage,
      });
      applyPastedText(markdown, { imageCount });
    } catch (err) {
      setError(err.message || "Tempel gagal dibaca");
    } finally {
      setImporting(false);
    }
  };

  const applyDroppedImages = async (files) => {
    if (!requireIT()) return;
    setImporting(true);
    setError("");
    setOkMsg("");
    try {
      const { markdown, imageCount } = await filesToImageMarkdown(files, {
        upload: uploadImage,
      });
      applyPastedText(markdown, { imageCount });
    } catch (err) {
      setError(err.message || "Gambar gagal diunggah");
    } finally {
      setImporting(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!requireIT()) return;
    const clientError = validateKnowledgeDraft(draft);
    if (clientError) {
      setOkMsg("");
      setError(clientError);
      requestAnimationFrame(() => {
        document.getElementById("knowledge-save-feedback")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
      return;
    }
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const body = {
        docType: draft.docType === "technical" ? "technical" : "howto",
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
      let warnings = [];
      if (activeId) {
        const res = await hubApi.updateDoc(activeId, body);
        saved = res.data;
        warnings = res.warnings || [];
      } else {
        const res = await hubApi.createDoc(body);
        saved = res.data;
        warnings = res.warnings || [];
      }
      if (!saved?._id) {
        throw new Error("Simpan berhasil tanpa id dokumen — coba muat ulang halaman");
      }
      await load();
      setActiveId(saved._id);
      setFromImport(false);
      setMode("view");
      setOkMsg(
        warnings.length
          ? `Tersimpan. Catatan: ${warnings.join(" ")}`
          : "Knowledge tersimpan dan diindeks untuk AI",
      );
    } catch (err) {
      setOkMsg("");
      setError(err.message || "Gagal menyimpan");
      requestAnimationFrame(() => {
        document.getElementById("knowledge-save-feedback")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!requireIT() || !activeId) return;
    if (!window.confirm("Hapus knowledge ini?")) return;
    try {
      await hubApi.deleteDoc(activeId);
      setMode("list");
      setActiveId(null);
      await load();
      setOkMsg("Knowledge dihapus");
    } catch (err) {
      setError(err.message || "Gagal menghapus");
    }
  };

  const docsHref = ({ app = tagFilter, ai = aiFilter } = {}) => {
    const params = new URLSearchParams();
    if (ai === "howto" || ai === "technical") params.set("ai", ai);
    if (app && app !== "all") params.set("app", app);
    const qs = params.toString();
    return qs ? `/docs?${qs}` : "/docs";
  };

  const clearAppFilter = () => {
    setTagFilter("all");
    navigate(docsHref({ app: "all" }));
  };

  const applyTagFilter = (id) => {
    setTagFilter(id);
    navigate(docsHref({ app: id }));
  };

  const applyAiFilter = (id) => {
    setAiFilter(id);
    navigate(docsHref({ ai: id }));
  };

  return (
    <div className="blog-docs knowledge-page">
      <header className="page-head blog-head">
        <div>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {mode !== "list" && (
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              setFromImport(false);
              setMode("list");
            }}
          >
            ← Daftar knowledge
          </button>
        )}
      </header>

      <aside className="knowledge-rules" aria-label="Aturan knowledge">
        <strong>Aturan korpus</strong>
        <ul>
          {KNOWLEDGE_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </aside>

      {error && <div className="alert error">{error}</div>}
      {okMsg && <div className="alert ok">{okMsg}</div>}

      {mode === "list" && canEdit && (
        <div
          className={`pdf-drop${dragOver ? " over" : ""}`}
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const files = [...(e.dataTransfer.files || [])];
            const blocked = files.find(isBlockedSpreadsheet);
            if (blocked) {
              setError(validateImportFile(blocked));
              return;
            }
            const file = files.find(isImportFile);
            if (file) {
              importDocumentFile(file, {
                extra: files.length > 1 ? " Satu berkas sekali jatuh." : "",
              });
              return;
            }
            const images = files.filter(isImageFile);
            if (images.length) {
              applyDroppedImages(images);
              return;
            }
            setError("Format: CSV (tabel), PDF/DOC (narasi), TXT — bukan XLSX");
          }}
          onPaste={(e) => {
            const files = [...(e.clipboardData?.files || [])];
            const blocked = files.find(isBlockedSpreadsheet);
            if (blocked) {
              e.preventDefault();
              setError(validateImportFile(blocked));
              return;
            }
            const file = files.find(isImportFile);
            if (file) {
              e.preventDefault();
              importDocumentFile(file);
              return;
            }
            if (clipboardHasImages(e.clipboardData)) {
              e.preventDefault();
              applyPastedClipboard(e.clipboardData);
              return;
            }
            const text = e.clipboardData?.getData("text") || "";
            if (text.trim().length > 20) {
              e.preventDefault();
              applyPastedText(text);
            }
          }}
        >
          <strong>Impor: CSV · TXT · PDF/DOC (narasi)</strong>
          <p>
            Satu topik per berkas. Tabel → CSV. XLSX ditolak. Tandai aplikasi di editor sebelum
            simpan.
          </p>
          <button
            className="btn secondary"
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? "Membaca berkas…" : "Pilih berkas"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMPORT_ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              importDocumentFile(file);
            }}
          />
          <div className="paste-box ">
            <label htmlFor="docs-paste">Tempel teks / markdown (bukan dump massal)</label>
            <textarea
              id="docs-paste"
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="SOP singkat atau markdown table. Max 80.000 karakter setelah simpan."
            />
            <button
              className="btn secondary"
              type="button"
              disabled={importing || !pasteText.trim()}
              onClick={() => applyPastedText(pasteText)}
            >
              Buat draf dari teks
            </button>
          </div>
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
              className={`chip-btn${aiFilter === "all" ? " active" : ""}`}
              onClick={() => applyAiFilter("all")}
            >
              Semua untuk AI
            </button>
            <button
              type="button"
              className={`chip-btn${aiFilter === "howto" ? " active" : ""}`}
              onClick={() => applyAiFilter("howto")}
            >
              How to use
            </button>
            <button
              type="button"
              className={`chip-btn${aiFilter === "technical" ? " active" : ""}`}
              onClick={() => applyAiFilter("technical")}
            >
              Teknikal
            </button>
          </div>

          <div className="tag-row">
            <button
              type="button"
              className={`chip-btn${tagFilter === "all" ? " active" : ""}`}
              onClick={clearAppFilter}
            >
              Semua kategori
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
            {customCategories.map((tag) => (
              <button
                key={`custom-${tag}`}
                type="button"
                className={`chip-btn${tagFilter === tag ? " active" : ""}`}
                onClick={() => applyTagFilter(tag)}
              >
                {tagLabel(tag)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="panel">Memuat…</div>
          ) : filtered.length === 0 ? (
            <div className="panel">
              Belum ada knowledge
              {tagFilter !== "all" ? ` untuk “${tagLabel(tagFilter)}”` : ""}.
              {canEdit ? " Impor CSV/TXT atau tempel teks di atas." : ""}
            </div>
          ) : (
            <div className="blog-list">
              {filtered.map((doc) => (
                <button
                  key={doc._id}
                  type="button"
                  className="blog-row"
                  onClick={() => openView(doc._id)}
                >
                  <span className="blog-row-main">
                    <strong>{doc.title}</strong>
                    {doc.summary ? <span>{doc.summary}</span> : null}
                  </span>
                  <span className="blog-row-meta">
                    <span className="chip">{aiRoleLabel(doc.docType)}</span>
                    {(doc.tags || []).slice(0, 2).map((t) => (
                      <span key={t} className="chip">
                        {tagLabel(t)}
                      </span>
                    ))}
                    <time>{formatDocDate(doc.updatedAt || doc.createdAt)}</time>
                  </span>
                </button>
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
            <span className="chip">{aiRoleLabel(active.docType)}</span>
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
              placeholder="Judul knowledge"
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
              placeholder="Satu kalimat untuk daftar & retrieve"
            />
          </div>

          <div className="field">
            <label>Aplikasi (pilih satu — atau Others)</label>
            <div className="tag-row">
              <button
                type="button"
                className={`chip-btn${draft.tags.includes(TAG_OTHERS) ? " active" : ""}`}
                onClick={() => setAppCategory(TAG_OTHERS)}
              >
                Others
              </button>
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className={`chip-btn${draft.appId === app.id ? " active" : ""}`}
                  onClick={() => setAppCategory(app.id)}
                >
                  {app.title}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Kategori custom</label>
            <p className="blog-hint">
              Otomatis dari nama berkas/isi saat impor. Bisa tambah atau cabut sebelum simpan.
            </p>
            <div className="tag-row">
              {draftCustomTags.map((tag) => (
                <button
                  key={`draft-${tag}`}
                  type="button"
                  className="chip-btn active"
                  onClick={() => toggleCustomTag(tag)}
                  title="Klik untuk cabut"
                >
                  {tagLabel(tag)} ×
                </button>
              ))}
              {customCategories
                .filter((tag) => !draftCustomTags.includes(tag))
                .slice(0, 12)
                .map((tag) => (
                  <button
                    key={`pick-${tag}`}
                    type="button"
                    className="chip-btn"
                    onClick={() => toggleCustomTag(tag)}
                  >
                    + {tagLabel(tag)}
                  </button>
                ))}
            </div>
            <div className="knowledge-custom-tag">
              <input
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                placeholder="Tambah kategori, mis. harga-distributor"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTagFromInput();
                  }
                }}
              />
              <button
                type="button"
                className="btn secondary"
                onClick={addCustomTagFromInput}
                disabled={!customTagInput.trim()}
              >
                Tambah
              </button>
            </div>
          </div>

          <div className="field">
            <label>Untuk AI</label>
            <select
              value={draft.docType === "technical" ? "technical" : "howto"}
              onChange={(e) => {
                const docType = e.target.value === "technical" ? "technical" : "howto";
                setDraft((d) => ({
                  ...d,
                  docType,
                  visibility: docType === "howto" ? "public" : "internal",
                }));
              }}
            >
              <option value="howto">How to use — prosedur singkat (1 cuplikan RAG)</option>
              <option value="technical">Teknikal — catatan panjang (beberapa cuplikan RAG)</option>
            </select>
            <p className="blog-hint">
              Penyimpanan dan indeks sama. Pilihan ini hanya mengatur cara AI memotong dokumen.
            </p>
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
            {fromImport && (
              <p className="blog-hint">
                Draf impor. Periksa aplikasi + visibility, lalu simpan agar ter-embed.
              </p>
            )}
          </div>

          <div className="field">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowCover((v) => !v)}
            >
              {showCover ? "Sembunyikan cover" : "Cover opsional"}
            </button>
            {showCover ? (
              <div className="blog-cover-edit" style={{ marginTop: "0.5rem" }}>
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
                      onClick={() => setDraft((d) => ({ ...d, coverImage: "" }))}
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
            ) : null}
          </div>

          <div className="field">
            <label>
              Konten (markdown){" "}
              <span className="blog-hint">
                {contentLen.toLocaleString("id-ID")} /{" "}
                {MAX_KNOWLEDGE_CONTENT_CHARS.toLocaleString("id-ID")}
              </span>
            </label>
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
              onPaste={(e) => {
                if (!clipboardHasImages(e.clipboardData)) return;
                e.preventDefault();
                const data = e.clipboardData;
                (async () => {
                  setUploading(true);
                  setError("");
                  try {
                    const { markdown, imageCount } = await clipboardToMarkdown(data, {
                      upload: uploadImage,
                    });
                    const snippet = markdown.startsWith("\n") ? markdown : `\n${markdown}\n`;
                    const el = contentRef.current;
                    setDraft((d) => {
                      const start = el?.selectionStart ?? d.content.length;
                      const end = el?.selectionEnd ?? start;
                      const next = d.content.slice(0, start) + snippet + d.content.slice(end);
                      requestAnimationFrame(() => {
                        if (!el) return;
                        el.focus();
                        const pos = start + snippet.length;
                        el.setSelectionRange(pos, pos);
                      });
                      return { ...d, content: next };
                    });
                    if (imageCount) setOkMsg(`${imageCount} gambar ikut tertempel.`);
                  } catch (err) {
                    setError(err.message || "Gambar gagal diunggah");
                  } finally {
                    setUploading(false);
                  }
                })();
              }}
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

          <div id="knowledge-save-feedback">
            {error ? <div className="alert error">{error}</div> : null}
            {okMsg && mode === "edit" ? <div className="alert ok">{okMsg}</div> : null}
          </div>

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
