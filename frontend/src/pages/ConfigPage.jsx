import { useEffect, useState } from "react";
import configApi from "../api/configApi";

/**
 * Nama tab = prefix field di Organization.model.js (tanpa _URL/_USERNAME/…).
 * Urutan mengikuti model.
 */
const SERVICES = [
  {
    id: "SOAP_PRODUCT",
    prefix: "SOAP_PRODUCT_",
    hint: "Sinkron produk CSI (cron-product)",
  },
  {
    id: "SOAP_PRODUCT_RIL",
    prefix: "SOAP_PRODUCT_RIL_",
    hint: "Sinkron produk RIL (cron-product dual source)",
  },
  {
    id: "SOAP_CUSTOMER",
    prefix: "SOAP_CUSTOMER_",
    hint: "Data customer NAV",
  },
  {
    id: "SOAP_TRANSACTION",
    prefix: "SOAP_TRANSACTION_",
    hint: "Sales order pending / released",
  },
  {
    id: "SOAP_PEMBAYARANTERTUNDA",
    prefix: "SOAP_PEMBAYARANTERTUNDA_",
    hint: "Pembayaran tertunda (overdue)",
  },
  {
    id: "SOAP_CHECKSTATUSNAV",
    prefix: "SOAP_CHECKSTATUSNAV_",
    hint: "Cek status dokumen di NAV",
  },
  {
    id: "SOAP_STOCK",
    prefix: "SOAP_STOCK_",
    hint: "Stok yang bisa dijual (non-reserved)",
  },
  {
    id: "SOAP_INVENTORY",
    prefix: "SOAP_INVENTORY_",
    hint: "Inventory total gudang (termasuk reserved)",
  },
];

const SOAP_FIELDS = [
  { suffix: "URL", hint: "Endpoint WSDL / service" },
  { suffix: "USERNAME", hint: "NTLM / basic user" },
  { suffix: "PASSWORD", hint: "Kosongkan jika tidak diubah" },
  { suffix: "SOAPACTION", hint: "Header SOAPAction" },
  { suffix: "XMLNS", hint: "Namespace XML" },
];

const AD_FIELDS = [
  { key: "AD_HOST", hint: "Host LDAP / Active Directory" },
  { key: "AD_PORT", hint: "Port LDAP (biasanya 389)" },
  { key: "AD_DOMAIN", hint: "Domain bind, mis. CSI" },
  { key: "AD_BASE_DN", hint: "Contoh: DC=csi,DC=my,DC=id" },
];

const SMTP_FIELDS = [
  { key: "EMAIL_HOST", hint: "SMTP host" },
  { key: "EMAIL_PORT", hint: "Biasanya 587 atau 465" },
  { key: "EMAIL_USER", hint: "Alamat pengirim / auth user" },
  { key: "EMAIL_PASS", hint: "Kosongkan jika tidak diubah" },
];

const emptyForm = {
  AD_HOST: "",
  AD_PORT: "",
  AD_DOMAIN: "",
  AD_BASE_DN: "",
  EMAIL_HOST: "",
  EMAIL_PORT: "",
  EMAIL_SECURE: false,
  EMAIL_USER: "",
  EMAIL_PASS: "",
};

for (const service of SERVICES) {
  for (const field of SOAP_FIELDS) {
    emptyForm[`${service.prefix}${field.suffix}`] = "";
  }
}

export default function ConfigPage() {
  const [form, setForm] = useState(emptyForm);
  const [openIndex, setOpenIndex] = useState(0);
  const [passwordConfigured, setPasswordConfigured] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await configApi.getAllConfig();
        setForm((prev) => ({
          ...prev,
          ...(res?.data || {}),
          EMAIL_SECURE: Boolean(res?.data?.EMAIL_SECURE),
        }));
        setPasswordConfigured(res?.passwordConfigured || {});
      } catch (err) {
        setError(err.message || "Gagal memuat config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => {
          if (typeof value === "boolean") return true;
          return value !== "" && value !== null && value !== undefined;
        }),
      );
      const res = await configApi.updateAllConfig(payload);
      setMessage(res?.message || "Config tersimpan");
      setForm((prev) => ({
        ...prev,
        ...(res?.data || {}),
        EMAIL_SECURE: Boolean(res?.data?.EMAIL_SECURE ?? prev.EMAIL_SECURE),
      }));
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const onTestSmtp = async () => {
    setTestingSmtp(true);
    setMessage("");
    setError("");
    try {
      const res = await configApi.testSMTP({});
      setMessage(res?.message || "SMTP OK");
    } catch (err) {
      setError(err.message || "Uji SMTP gagal");
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return <div className="panel">Memuat konfigurasi...</div>;
  }

  const active = SERVICES[openIndex];

  return (
    <div>
      <header className="page-head">
        <h1>Konfigurasi</h1>
        <p>
          Nama field sama persis dengan{" "}
          <code>Organization.model.js</code>. Field kosong tidak menimpa nilai
          lama.
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}

      <section className="panel config-section">
        <h2>Active Directory</h2>
        <p className="config-section-hint">
          Field: <code>AD_HOST</code>, <code>AD_PORT</code>,{" "}
          <code>AD_DOMAIN</code>, <code>AD_BASE_DN</code>
        </p>
        <div className="config-grid">
          {AD_FIELDS.map(({ key, hint }) => (
            <div className="field" key={key}>
              <label>
                <code>{key}</code>
              </label>
              <input
                value={form[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={hint}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel config-section">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>SMTP</h2>
            <p className="config-section-hint" style={{ marginBottom: 0 }}>
              Field: <code>EMAIL_HOST</code>, <code>EMAIL_PORT</code>,{" "}
              <code>EMAIL_USER</code>, <code>EMAIL_PASS</code>,{" "}
              <code>EMAIL_SECURE</code>
            </p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={onTestSmtp}
            disabled={testingSmtp}
          >
            {testingSmtp ? "Menguji…" : "Uji kirim email"}
          </button>
        </div>
        <div className="config-grid">
          {SMTP_FIELDS.map(({ key, hint }) => (
            <div className="field" key={key}>
              <label>
                <code>{key}</code>
                {key === "EMAIL_PASS" && passwordConfigured.EMAIL_PASS
                  ? " · sudah terisi"
                  : ""}
              </label>
              <input
                type={key === "EMAIL_PASS" ? "password" : "text"}
                value={form[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={hint}
              />
            </div>
          ))}
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(form.EMAIL_SECURE)}
            onChange={(e) => setField("EMAIL_SECURE", e.target.checked)}
          />
          <code>EMAIL_SECURE</code> — TLS/SSL langsung (biasanya port 465)
        </label>
      </section>

      <section className="panel config-section">
        <h2>SOAP (Org fields)</h2>
        <p className="config-section-hint">
          Pilih grup prefix. Contoh: tab{" "}
          <code>SOAP_PRODUCT_RIL</code> mengedit{" "}
          <code>SOAP_PRODUCT_RIL_URL</code>,{" "}
          <code>SOAP_PRODUCT_RIL_USERNAME</code>, dst. Jangan tertukar dengan{" "}
          <code>SOAP_PRODUCT</code> (CSI).
        </p>
        <div className="soap-tabs">
          {SERVICES.map((service, index) => (
            <button
              key={service.id}
              type="button"
              className={`soap-tab${openIndex === index ? " active" : ""}`}
              onClick={() => setOpenIndex(index)}
              title={service.hint}
            >
              <code>{service.id}</code>
            </button>
          ))}
        </div>
        <div className="soap-panel">
          <div className="soap-panel-head">
            <strong>
              <code>{active.id}</code>
            </strong>
            <span>{active.hint}</span>
          </div>
          <div className="config-grid soap-fields">
            {SOAP_FIELDS.map(({ suffix, hint }) => {
              const key = `${active.prefix}${suffix}`;
              const isPassword = suffix === "PASSWORD";
              return (
                <div
                  className={`field${suffix === "URL" || suffix === "XMLNS" ? " span-2" : ""}`}
                  key={key}
                >
                  <label>
                    <code>{key}</code>
                    {isPassword && passwordConfigured[key]
                      ? " · sudah terisi"
                      : ""}
                  </label>
                  <input
                    type={isPassword ? "password" : "text"}
                    value={form[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={hint}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <button className="btn" onClick={onSave} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan konfigurasi"}
          </button>
        </div>
      </section>
    </div>
  );
}
