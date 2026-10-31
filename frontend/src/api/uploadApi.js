import { http } from "./http";

export async function uploadImage(file) {
  const body = new FormData();
  body.append("file", file);
  const data = await http("/api/file/upload/img", { method: "POST", body });
  const url = data.url || data?.data?.url;
  if (!url) throw new Error("Upload berhasil tapi URL kosong");
  return url;
}
