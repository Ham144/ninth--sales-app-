import { useEffect, useState } from "react";
import { http } from "../api/http";
import { isIT } from "../lib/isIT";
import { Link } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

const PRESETS = [
  {
    id: "inherit",
    label: "Ikuti .env",
    baseUrl: "",
    models: [],
    hint: "Base URL, model, dan model cadangan kosong. Chat memakai LLM_BASE_URL, LLM_MODEL, dan LLM_FALLBACK_MODEL.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "deepseek/deepseek-chat",
      "deepseek/deepseek-v3.2",
      "google/gemini-2.5-flash",
      "openai/gpt-4.1-mini",
      "qwen/qwen3-235b-a22b",
    ],
    hint: "Model memakai id vendor/nama. Key Alibaba tidak berlaku di endpoint ini.",
  },
  {
    id: "alibaba",
    label: "Alibaba Model Studio (Tiongkok)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-flash", "qwen3-max"],
    hint: "Endpoint OpenAI-compatible DashScope. Ganti model ke id Qwen; slug OpenRouter tidak dikenali.",
  },
  {
    id: "alibaba-intl",
    label: "Alibaba Model Studio (Internasional)",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-flash", "qwen3-max"],
    hint: "Untuk API key region internasional. Tetap butuh model Qwen, bukan id OpenRouter.",
  },
  {
    id: "custom",
    label: "Endpoint lain",
    baseUrl: "",
    models: [],
    hint: "Base URL harus menyediakan POST /chat/completions dan tool calling bergaya OpenAI.",
  },
];

const SOURCE = {
  saved: "tersimpan",
  env: ".env",
  default: "bawaan",
  none: "tidak ada",
  missing: "belum ada",
};

const empty = {
  systemPrompt: "",
  dailyTokenBudget: 200000,
  handoffWebhookUrl: "",
  allowedOrigins: "",
  baseUrl: "",
  model: "",
  fallbackModel: "",
  apiKey: "",
  hasApiKey: false,
  clearApiKey: false,
  preciseBaseUrl: "",
  preciseModel: "",
  preciseFallbackModel: "",
  preciseApiKey: "",
  preciseHasApiKey: false,
  preciseClearApiKey: false,
  enabledTools: [],
  tools: [],
};

function presetById(id) {
  return PRESETS.find((item) => item.id === id) || PRESETS[0];
}

function providerFromUrl(url) {
  const value = String(url || "");
  if (value.includes("dashscope-intl.aliyuncs.com")) return "alibaba-intl";
  if (value.includes("dashscope.aliyuncs.com")) return "alibaba";
  if (value.includes("openrouter.ai")) return "openrouter";
  if (!value) return "inherit";
  return "custom";
}

function inferProvider(form) {
  if (!form.baseUrl && !form.model && !form.fallbackModel) return "inherit";
  return providerFromUrl(form.baseUrl);
}

export default function AgentConfigPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = isIT(user);
  const [form, setForm] = useState(empty);
  const [provider, setProvider] = useState("inherit");
  const [modelMode, setModelMode] = useState("preset");
  const [fallbackMode, setFallbackMode] = useState("preset");
  const [effective, setEffective] = useState(null);
  const [effectiveModes, setEffectiveModes] = useState({ fast: null, precise: null });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http("/api/v1/agent/admin/tenant");
      const data = res?.data || {};
      const next = {
        systemPrompt: data.systemPrompt || "",
        dailyTokenBudget: data.dailyTokenBudget || 200000,
        handoffWebhookUrl: data.handoffWebhookUrl || "",
        allowedOrigins: (data.allowedOrigins || []).join("\n"),
        baseUrl: data.llm?.baseUrl || "",
        model: data.llm?.model || "",
        fallbackModel: data.llm?.fallbackModel || "",
        apiKey: "",
        hasApiKey: Boolean(data.llm?.hasApiKey),
        clearApiKey: false,
        preciseBaseUrl: data.llmModes?.precise?.baseUrl || "",
        preciseModel: data.llmModes?.precise?.model || "",
        preciseFallbackModel: data.llmModes?.precise?.fallbackModel || "",
        preciseApiKey: "",
        preciseHasApiKey: Boolean(data.llmModes?.precise?.hasApiKey),
        preciseClearApiKey: false,
        tools: data.tools || [],
        enabledTools: (data.tools || []).filter((tool) => tool.enabled).map((tool) => tool.name),
      };
      const chosen = inferProvider(next);
      const models = presetById(chosen).models;
      setForm(next);
      setProvider(chosen);
      setModelMode(!next.model || models.includes(next.model) || !models.length ? "preset" : "custom");
      setFallbackMode(
        !next.fallbackModel || models.includes(next.fallbackModel) || !models.length ? "preset" : "custom",
      );
      setEffective(data.effective || data.effectiveModes?.fast || null);
      setEffectiveModes({
        fast: data.effectiveModes?.fast || data.effective || null,
        precise: data.effectiveModes?.precise || null,
      });
    } catch (err) {
      setError(err.message || "Gagal memuat pengaturan agent");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canEdit) load();
    else setLoading(false);
  }, [canEdit]);

  const applyProvider = (id) => {
    const preset = presetById(id);
    setProvider(id);
    setModelMode("preset");
    setFallbackMode("preset");
    setForm((current) => {
      if (id === "inherit") {
        return { ...current, baseUrl: "", model: "", fallbackModel: "" };
      }
      const keepModel = preset.models.includes(current.model);
      const keepFallback = preset.models.includes(current.fallbackModel);
      return {
        ...current,
        baseUrl: id === "custom" ? current.baseUrl : preset.baseUrl,
        model: keepModel ? current.model : preset.models[0] || current.model,
        fallbackModel: keepFallback ? current.fallbackModel : "",
      };
    });
  };

  const toggleTool = (name) => {
    setForm((current) => {
      const has = current.enabledTools.includes(name);
      return {
        ...current,
        enabledTools: has
          ? current.enabledTools.filter((item) => item !== name)
          : [...current.enabledTools, name],
      };
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    const llm = {
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      fallbackModel: form.fallbackModel.trim(),
    };
    if (form.clearApiKey) llm.apiKey = "";
    else if (form.apiKey.trim()) llm.apiKey = form.apiKey.trim();
    const precise = {
      baseUrl: form.preciseBaseUrl.trim(),
      model: form.preciseModel.trim(),
      fallbackModel: form.preciseFallbackModel.trim(),
    };
    if (form.preciseClearApiKey) precise.apiKey = "";
    else if (form.preciseApiKey.trim()) precise.apiKey = form.preciseApiKey.trim();
    try {
      await http("/api/v1/agent/admin/tenant", {
        method: "PUT",
        body: {
          systemPrompt: form.systemPrompt,
          dailyTokenBudget: Number(form.dailyTokenBudget) || 0,
          handoffWebhookUrl: form.handoffWebhookUrl,
          allowedOrigins: form.allowedOrigins
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          enabledTools: form.enabledTools,
          llm,
          llmModes: { precise },
        },
      });
      setOk("Pengaturan tersimpan. Chat berikutnya memakai nilai di panel runtime.");
      await load();
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const preset = presetById(provider);
  const modelChoices = preset.models;
  const showModelText = provider === "custom" || modelMode === "custom" || !modelChoices.length;
  const showFallbackText = provider === "custom" || fallbackMode === "custom" || !modelChoices.length;

  if (!canEdit) {
    return (
      <div>
        <header className="page-head">
          <h1>Pengaturan Agent</h1>
          <p>Hanya user IT yang boleh mengubah model, prompt, kuota, dan tool.</p>
        </header>
        <div className="alert">Chat internal tetap bisa dipakai dari menu Agent.</div>
      </div>
    );
  }

  return (
    <div className="agent-config">
      <header className="page-head">
        <h1>Pengaturan Agent</h1>
        <p>
          Nilai yang disimpan di sini mengalahkan <code>LLM_*</code> di <code>.env</code>. Field model yang dikosongkan jatuh kembali ke environment. SOAP, AD, dan SMTP tetap di{" "}
          <Link to="/config">Konfigurasi</Link>. Panduan pemasang ada di{" "}
          <Link to="/agent-docs">dokumentasi integrasi</Link>.
        </p>
      </header>
      {error && <div className="alert error">{error}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <>
          <section className="agent-runtime panel">
            <div className="agent-runtime-head">
              <h2>Yang dipakai chat sekarang</h2>
              <span className={`source-chip ${effective?.ok === false ? "bad" : "ok"}`}>
                {effective?.ok === false ? "tidak bisa dipakai" : "siap"}
              </span>
            </div>
            {effective?.ok === false ? (
              <p className="agent-note">{effective.message}</p>
            ) : (
              ["fast", "precise"].map((id) => {
                const row = id === "fast" ? effectiveModes.fast || effective : effectiveModes.precise;
                const title = id === "fast" ? "Cepat" : "Teliti";
                if (!row) return null;
                return (
                  <div key={id} className="agent-runtime-mode">
                    <h3>{title}</h3>
                    {row.ok === false ? (
                      <p className="agent-note">{row.message || "Belum dikonfigurasi"}</p>
                    ) : (
                      <dl className="agent-runtime-grid">
                        <div>
                          <dt>Base URL</dt>
                          <dd>{row.baseUrl || "—"}</dd>
                          <span className="source-chip">{SOURCE[row.source?.baseUrl] || "—"}</span>
                        </div>
                        <div>
                          <dt>Model</dt>
                          <dd>{row.model || "—"}</dd>
                          <span className="source-chip">{SOURCE[row.source?.model] || "—"}</span>
                        </div>
                        <div>
                          <dt>API key</dt>
                          <dd>{row.hasApiKey ? "tersedia" : "belum ada"}</dd>
                          <span className="source-chip">{SOURCE[row.source?.apiKey] || "—"}</span>
                        </div>
                      </dl>
                    )}
                  </div>
                );
              })
            )}
            <p className="agent-note">
              Mengganti token di <code>.env</code> saja tidak cukup kalau base URL atau model di panel ini berstatus tersimpan. Key Alibaba butuh base URL DashScope dan model Qwen sekaligus.
            </p>
          </section>

          <form onSubmit={save} className="agent-form">
            <section className="panel">
              <h2>Model</h2>
              <div className="field">
                <label htmlFor="agent-provider">Penyedia</label>
                <select id="agent-provider" value={provider} onChange={(event) => applyProvider(event.target.value)}>
                  {PRESETS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="agent-note">{preset.hint}</p>
              </div>
              {provider !== "inherit" && (
                <div className="field">
                  <label htmlFor="agent-base">Base URL</label>
                  <input
                    id="agent-base"
                    value={form.baseUrl}
                    onChange={(event) => {
                      const baseUrl = event.target.value;
                      setForm((current) => ({ ...current, baseUrl }));
                      if (provider !== "custom") setProvider(providerFromUrl(baseUrl));
                    }}
                    placeholder={effective?.baseUrl || "https://.../v1"}
                    spellCheck={false}
                  />
                </div>
              )}
              {provider !== "inherit" && (
                <div className="toolbar">
                  <ModelField
                    id="agent-model"
                    label="Model"
                    value={form.model}
                    mode={showModelText ? "custom" : modelMode}
                    choices={modelChoices}
                    placeholder={effective?.model || "qwen-plus"}
                    onMode={setModelMode}
                    onChange={(model) => setForm((current) => ({ ...current, model }))}
                  />
                  <ModelField
                    id="agent-fallback"
                    label="Model cadangan"
                    value={form.fallbackModel}
                    mode={showFallbackText ? "custom" : fallbackMode}
                    choices={modelChoices}
                    placeholder="kosongkan jika tidak dipakai"
                    allowEmpty
                    onMode={setFallbackMode}
                    onChange={(fallbackModel) => setForm((current) => ({ ...current, fallbackModel }))}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="agent-key">
                  API key {form.hasApiKey ? "tersimpan" : "belum tersimpan di database"}
                </label>
                <input
                  id="agent-key"
                  type="password"
                  value={form.apiKey}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, apiKey: event.target.value, clearApiKey: false }))
                  }
                  placeholder={form.hasApiKey ? "Kosongkan untuk mempertahankan key yang ada" : "Kosongkan untuk memakai LLM_API_KEY"}
                  autoComplete="off"
                  disabled={form.clearApiKey}
                />
                {form.hasApiKey && (
                  <label className="tool-check">
                    <input
                      type="checkbox"
                      checked={form.clearApiKey}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          clearApiKey: event.target.checked,
                          apiKey: event.target.checked ? "" : current.apiKey,
                        }))
                      }
                    />
                    <span>Hapus key tersimpan dan pakai LLM_API_KEY dari .env</span>
                  </label>
                )}
              </div>
              <div className="agent-runtime-head" style={{ marginTop: "1.25rem" }}>
                <div>
                  <h3>Mode Teliti</h3>
                  <p className="agent-note">
                    Opsional. Model wajib diisi untuk mengaktifkan pilihan Teliti. Base URL dan key
                    yang kosong memakai konfigurasi mode Cepat, sehingga kedua mode boleh memakai
                    provider berbeda.
                  </p>
                </div>
              </div>
              <div className="field">
                <label htmlFor="agent-precise-base">Base URL Teliti</label>
                <input
                  id="agent-precise-base"
                  value={form.preciseBaseUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, preciseBaseUrl: event.target.value }))
                  }
                  placeholder="Kosongkan untuk memakai Base URL Cepat"
                  spellCheck={false}
                />
              </div>
              <div className="toolbar">
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="agent-precise-model">Model Teliti</label>
                  <input
                    id="agent-precise-model"
                    value={form.preciseModel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, preciseModel: event.target.value }))
                    }
                    placeholder="Contoh: qwen-max atau vendor/model"
                  />
                </div>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="agent-precise-fallback">Cadangan Teliti</label>
                  <input
                    id="agent-precise-fallback"
                    value={form.preciseFallbackModel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, preciseFallbackModel: event.target.value }))
                    }
                    placeholder="Opsional"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="agent-precise-key">
                  API key Teliti {form.preciseHasApiKey ? "tersimpan" : "mengikuti mode Cepat"}
                </label>
                <input
                  id="agent-precise-key"
                  type="password"
                  value={form.preciseApiKey}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      preciseApiKey: event.target.value,
                      preciseClearApiKey: false,
                    }))
                  }
                  placeholder={
                    form.preciseHasApiKey
                      ? "Kosongkan untuk mempertahankan key"
                      : "Kosongkan untuk memakai key Cepat"
                  }
                  autoComplete="off"
                  disabled={form.preciseClearApiKey}
                />
                {form.preciseHasApiKey && (
                  <label className="tool-check">
                    <input
                      type="checkbox"
                      checked={form.preciseClearApiKey}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          preciseClearApiKey: event.target.checked,
                          preciseApiKey: event.target.checked ? "" : current.preciseApiKey,
                        }))
                      }
                    />
                    <span>Hapus key Teliti tersimpan dan pakai key mode Cepat</span>
                  </label>
                )}
              </div>
            </section>

            <section className="panel">
              <h2>Batas dan saluran</h2>
              <div className="field">
                <label htmlFor="agent-prompt">System prompt tambahan</label>
                <textarea
                  id="agent-prompt"
                  rows={5}
                  value={form.systemPrompt}
                  onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
                  placeholder="Kosongkan untuk memakai prompt internal bawaan"
                />
              </div>
              <div className="toolbar">
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="agent-budget">Kuota token harian pengunjung</label>
                  <input
                    id="agent-budget"
                    type="number"
                    min="1"
                    value={form.dailyTokenBudget}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dailyTokenBudget: event.target.value }))
                    }
                  />
                  <p className="agent-note">Hanya untuk chatbot pengunjung. Copilot staf internal tidak memakai kuota ini.</p>
                </div>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="agent-hook">Webhook handoff</label>
                  <input
                    id="agent-hook"
                    value={form.handoffWebhookUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, handoffWebhookUrl: event.target.value }))
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="agent-origins">Origin yang diizinkan, satu per baris</label>
                <textarea
                  id="agent-origins"
                  rows={3}
                  value={form.allowedOrigins}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, allowedOrigins: event.target.value }))
                  }
                />
              </div>
            </section>

            <section className="panel">
              <div className="agent-runtime-head">
                <h2>Tool aktif</h2>
                <span className="source-chip">
                  {form.enabledTools.length}/{form.tools.length}
                </span>
              </div>
              <div className="tool-grid">
                {form.tools.map((tool) => {
                  const on = form.enabledTools.includes(tool.name);
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      className={`tool-card${on ? " on" : ""}`}
                      onClick={() => toggleTool(tool.name)}
                      aria-pressed={on}
                    >
                      <strong>{tool.name}</strong>
                      <span>{tool.description || tool.tier || "internal"}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="agent-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Menyimpan" : "Simpan"}
              </button>
              <button className="btn ghost" type="button" disabled={saving} onClick={() => applyProvider("inherit")}>
                Kosongkan model di form
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function ModelField({ id, label, value, mode, choices, placeholder, allowEmpty, onMode, onChange }) {
  const known = !value || choices.includes(value);
  return (
    <div className="field" style={{ flex: 1, margin: 0 }}>
      <label htmlFor={id}>{label}</label>
      {mode === "custom" || !choices.length ? (
        <input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <select
          id={id}
          value={known ? value : "__custom"}
          onChange={(event) => {
            if (event.target.value === "__custom") {
              onMode("custom");
              return;
            }
            onChange(event.target.value);
          }}
        >
          <option value="">{allowEmpty ? "Tidak dipakai" : "Ikuti .env"}</option>
          {choices.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value="__custom">Ketik sendiri</option>
        </select>
      )}
      {mode === "custom" && choices.length > 0 && (
        <button className="text-link" type="button" onClick={() => onMode("preset")}>
          Pilih dari daftar
        </button>
      )}
    </div>
  );
}
