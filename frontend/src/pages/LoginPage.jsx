import { useEffect, useState } from "react";
import { authApi } from "../api/authApi";
import { setAuthToken } from "../api/http";
import { navigate } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    selectedOrg: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi
      .searchOrgs("*")
      .then((res) => setOrgs(res?.data || []))
      .catch(() => setOrgs([]));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authApi.loginLdap(form);
      // Backend returns { success, data: payload, access_token } + httpOnly cookies.
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
    <div style={{ maxWidth: 460, margin: "2rem auto" }}>
      <header className="page-head">
        <h1>Masuk System Hub</h1>
        <p>LDAP organisasi — untuk Config dan x-api-key di System Hub.</p>
      </header>
      {error && <div className="alert error">{error}</div>}
      <form className="panel" onSubmit={onSubmit}>
        <div className="field">
          <label>Organisasi</label>
          <select
            value={form.selectedOrg}
            onChange={(e) =>
              setForm((s) => ({ ...s, selectedOrg: e.target.value }))
            }
            required
          >
            <option value="">pilih organisasi</option>
            {orgs.map((org) => (
              <option key={org._id} value={org._id}>
                {org.organizationName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Username</label>
          <input
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
            value={form.password}
            onChange={(e) =>
              setForm((s) => ({ ...s, password: e.target.value }))
            }
            required
          />
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Masuk..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
