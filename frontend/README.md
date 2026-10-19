# CSI System Hub

Portal React + Vite untuk kumpulan aplikasi CSI.

## Jalankan

```bash
cd frontend
pnpm dev
# atau jika registry offline:
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173
```

Backend diproxy lewat `/api` → `VITE_PROXY_TARGET`.

## Halaman

- `/` aplikasi + one-click login (redirect username/password)
- `/updates` changelog fitur
- `/docs` how to use
- `/technical` docs teknikal
- `/api-keys` x-api-key management
- `/config` konfigurasi org SOAP/AD/SMTP
- `/login` login hub (LDAP)
