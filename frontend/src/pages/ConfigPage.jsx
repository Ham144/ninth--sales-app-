import { useEffect, useState } from "react";
import configApi from "../api/configApi";

const SERVICES = [
  { label: "Product Service", prefix: "SOAP_PRODUCT_" },
  { label: "Product RIL Service", prefix: "SOAP_PRODUCT_RIL_" },
  { label: "Stock Service", prefix: "SOAP_STOCK_" },
  { label: "Customer Service", prefix: "SOAP_CUSTOMER_" },
  { label: "Sales Order Pending Service", prefix: "SOAP_TRANSACTION_" },
  { label: "Pembayaran Tertunda Service", prefix: "SOAP_PEMBAYARANTERTUNDA_" },
  { label: "Check Status NAV Service", prefix: "SOAP_CHECKSTATUSNAV_" },
  { label: "Inventory Service", prefix: "SOAP_INVENTORY_" },
];

const SOAP_FIELDS = ["URL", "USERNAME", "PASSWORD", "SOAPACTION", "XMLNS"];

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
    emptyForm[`${service.prefix}${field}`] = "";
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await configApi.getAllConfig();
        setForm((prev) => ({ ...prev, ...(res?.data || {}) }));
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
        Object.entries(form).filter(
          ([, value]) => value !== "" && value !== null && value !== undefined,
        ),
      );
      const res = await configApi.updateAllConfig(payload);
      setMessage(res?.message || "Config tersimpan");
      setForm((prev) => ({ ...prev, ...(res?.data || {}) }));
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="panel">Memuat konfigurasi...</div>;
  }

  const active = SERVICES[openIndex];

  return (
    <div>
      <header className="page-head">
        <h1>Konfigurasi organisasi</h1>
        <p>
          Field kosong tidak menimpa nilai lama. Sumber runtime SOAP product
          CSI/RIL ada di dokumen Org.
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Active Directory</h2>
        <div className="toolbar">
          {["AD_HOST", "AD_PORT", "AD_DOMAIN", "AD_BASE_DN"].map((key) => (
            <div className="field" style={{ flex: 1, minWidth: 160 }} key={key}>
              <label>{key}</label>
              <input
                value={form[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2>SMTP</h2>
        <div className="toolbar">
          {["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"].map((key) => (
            <div className="field" style={{ flex: 1, minWidth: 160 }} key={key}>
              <label>
                {key}
                {key === "EMAIL_PASS" && passwordConfigured.EMAIL_PASS
                  ? " (sudah terisi)"
                  : ""}
              </label>
              <input
                type={key === "EMAIL_PASS" ? "password" : "text"}
                value={form[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={
                  key === "EMAIL_PASS" && passwordConfigured.EMAIL_PASS
                    ? "biarkan kosong jika tidak diubah"
                    : ""
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>SOAP services</h2>
        <div className="doc-nav" style={{ margin: "0.75rem 0 1rem" }}>
          {SERVICES.map((service, index) => (
            <button
              key={service.prefix}
              className={openIndex === index ? "active" : ""}
              onClick={() => setOpenIndex(index)}
            >
              {service.label}
            </button>
          ))}
        </div>
        {SOAP_FIELDS.map((field) => {
          const key = `${active.prefix}${field}`;
          const isPassword = field === "PASSWORD";
          return (
            <div className="field" key={key}>
              <label>
                {key}
                {isPassword && passwordConfigured[key] ? " (sudah terisi)" : ""}
              </label>
              <input
                type={isPassword ? "password" : "text"}
                value={form[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={
                  isPassword && passwordConfigured[key]
                    ? "biarkan kosong jika tidak diubah"
                    : ""
                }
              />
            </div>
          );
        })}
        <button className="btn" onClick={onSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan konfigurasi"}
        </button>
      </section>
    </div>
  );
}
