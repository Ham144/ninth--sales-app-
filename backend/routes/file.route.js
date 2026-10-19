import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const name = Date.now() + "-" + file.originalname.replace(/\s/g, "_");
    cb(null, name);
  },
});

const upload = multer({ storage });

router.post("/upload/img", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  // Relative path so Vite proxy / production same-origin both work
  const url = `/uploads/${req.file.filename}`;
  res.json({ message: "ok", url, data: { url } });
});
export default router;
