import { useEffect, useState } from "react";
import { authApi } from "../api/authApi";
import { setAuthToken } from "../api/http";
import { navigate } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authApi.searchOrgs("*");
        const list = res?.data || [];
        // System Hub: org dipilih otomatis (biasanya satu). Tidak perlu dropdown.
        const primary = list[0];
        if (primary?._id) {
          setOrgId(primary._id);
          setOrgName(primary.organizationName || "");
        } else {
          setError("Organisasi belum terdaftar di server.");
        }
      } catch {
        setError("Gagal memuat organisasi. Coba refresh.");
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!orgId) {
      setError("Organisasi belum siap. Refresh halaman.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authApi.loginLdap({
        username: form.username,
        password: form.password,
        selectedOrg: orgId,
      });
      const user = res?.data || res?.user || null;
      const token = res?.access_token || null;
      setAuthToken(token);
      setSession(user, token);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/csi-logo.png" alt="CSI" />
          <div>
            <strong>CSI System Hub</strong>
            <span>Masuk dengan akun LDAP</span>
          </div>
        </div>

        <header className="page-head" style={{ marginBottom: "1.25rem" }}>
          <h1>Masuk</h1>
          <p>
            Untuk menulis update/docs, kelola x-api-key, dan konfigurasi.
            {orgName ? (
              <>
                {" "}
                Organisasi: <strong>{orgName}</strong>
              </>
            ) : null}
          </p>
        </header>

        {error && <div className="alert error">{error}</div>}

        {booting ? (
          <div className="panel">Menyiapkan…</div>
        ) : (
          <form className="panel login-form" onSubmit={onSubmit}>
            <div className="field">
              <label>Username</label>
              <input
                autoFocus
                autoComplete="username"
                value={form.username}
                onChange={(e) =>
                  setForm((s) => ({ ...s, username: e.target.value }))
                }
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) =>
                  setForm((s) => ({ ...s, password: e.target.value }))
                }
                required
              />
            </div>
            <div className="actions">
              <button
                className="btn"
                type="submit"
                disabled={loading || !orgId}
                style={{ width: "100%" }}
              >
                {loading ? "Masuk…" : "Masuk"}
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ width: "100%" }}
                onClick={() => navigate("/")}
              >
                Kembali ke hub
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
