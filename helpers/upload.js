// helpers/upload.js
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// 📁 Tentukan folder upload
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");

// 📂 Pastikan folder upload sudah ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 🧩 Konfigurasi multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Export semua yang dibutuhkan
module.exports = {
  upload,
  UPLOAD_DIR
};