function getToken() {
  return localStorage.getItem("hub_token") || "";
}

export async function uploadImage(file) {
  const token = getToken();
  const body = new FormData();
  body.append("file", file);

  const res = await fetch("/api/file/upload/img", {
    method: "POST",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Upload gagal (${res.status})`);
  }
  const url = data.url || data?.data?.url;
  if (!url) throw new Error("Upload berhasil tapi URL kosong");
  return url;
}
