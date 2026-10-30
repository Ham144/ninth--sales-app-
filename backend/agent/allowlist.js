export function applyAllowlist(payload, allowlist) {
  if (!allowlist?.length) return { redacted: true };
  const allow = new Set(allowlist);
  const pick = (value) => {
    if (Array.isArray(value)) return value.map(pick);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const key of Object.keys(value)) {
      if (!allow.has(key)) continue;
      out[key] = pick(value[key]);
    }
    return out;
  };
  return pick(payload);
}
