require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");

const app = express();

// =====================================================
// 🔧 KONFIGURASI DASAR
// =====================================================
const PATH_PROXY = "nano";
const DATA_FILE = path.join(__dirname, "data", "listings.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

// =====================================================
// 🧩 MIDDLEWARE & STATIC FILES
// =====================================================
app.use(`/${PATH_PROXY}`, express.static(path.join(__dirname, "public")));
app.use(`/${PATH_PROXY}/uploads`, express.static(UPLOAD_DIR));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// =====================================================
// ⚙️ VIEW ENGINE
// =====================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// =====================================================
// 📁 CEK & BUAT FOLDER JIKA BELUM ADA
// =====================================================
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// =====================================================
// 🔧 FUNGSI BANTU
// =====================================================
function readListings() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeListings(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =====================================================
// 📦 KONFIGURASI UPLOAD MULTER
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// =====================================================
// 🏠 ROUTE: HALAMAN UTAMA
// =====================================================
app.get(`/${PATH_PROXY}`, (req, res) => {
  const filters = req.query;
  let listings = readListings();

  // 🔍 Filter lokasi
  if (filters.location)
    listings = listings.filter((x) =>
      x.location.toLowerCase().includes(filters.location.toLowerCase())
    );

  // 🔍 Filter tipe properti
  if (filters.type)
    listings = listings.filter((x) => x.type === filters.type);

  // 💰 Sortir harga
  if (filters.sort === "price_asc") listings.sort((a, b) => a.price - b.price);
  if (filters.sort === "price_desc") listings.sort((a, b) => b.price - a.price);

  // 📄 Pagination
  const page = parseInt(filters.page) || 1;
  const perPage = 6;
  const totalPages = Math.ceil(listings.length / perPage);
  const paginated = listings.slice((page - 1) * perPage, page * perPage);

  res.render("index", {
    title: "NANO Properti",
    activePage: "home",
    PATH_PROXY,
    listings: paginated,
    filters,
    pagination: { currentPage: page, totalPages },
  });
});

// =====================================================
// ⚙️ ROUTE: ADMIN DASHBOARD
// =====================================================
app.get(`/${PATH_PROXY}/admin`, (req, res) => {
  const listings = readListings();
  res.render("admin", {
    title: "Admin Properti",
    activePage: "admin",
    PATH_PROXY,
    listings,
  });
});

// =====================================================
// 📝 ROUTE: FORM TAMBAH / EDIT PROPERTI
// =====================================================
app.get(`/${PATH_PROXY}/admin/form/:id?`, (req, res) => {
  const { id } = req.params;
  const listings = readListings();

  let property = null;
  if (id) {
    property = listings.find(l => String(l.id) === String(id)) || null;
  }

  res.render("admin-form", {
    title: id ? "Edit Properti" : "Tambah Properti Baru",
    activePage: "admin",
    PATH_PROXY,
    property
  });
});

// =====================================================
// 💾 ROUTE: SIMPAN / UPDATE PROPERTI
// =====================================================
app.post(`/${PATH_PROXY}/admin/save`, upload.array("media", 10), (req, res) => {
  const { id, title, price, type, location, contact, description } = req.body;
  const captions = req.body.captions ? req.body.captions.split("\n") : [];
  let listings = readListings();
  let property;

  if (id) {
    // ✏️ Edit Properti
    property = listings.find((l) => l.id === id);
    if (!property) {
      console.error(`❌ Properti ID ${id} tidak ditemukan`);
      return res.redirect(`/${PATH_PROXY}/admin`);
    }

    // Update data utama
    Object.assign(property, { title, price, type, location, contact, description });

    // Tambahkan media baru (jika diupload)
    if (req.files && req.files.length > 0) {
      const newMedia = req.files.map((file, i) => ({
        type: file.mimetype.startsWith("video") ? "video" : "image",
        src: file.filename,
        caption: captions[i] || "",
      }));
      property.media.push(...newMedia);
    }
  } else {
    // ➕ Tambah Properti Baru
    property = {
      id: Date.now().toString(),
      title,
      price,
      type,
      location,
      contact,
      description,
      media: (req.files || []).map((file, i) => ({
        type: file.mimetype.startsWith("video") ? "video" : "image",
        src: file.filename,
        caption: captions[i] || "",
      })),
    };
    listings.push(property);
  }

  writeListings(listings);
  console.log("✅ Properti disimpan:", property.title);
  res.redirect(`/${PATH_PROXY}/admin`);
});

// =====================================================
// 🗑️ ROUTE: HAPUS MEDIA
// =====================================================
app.get(`/${PATH_PROXY}/admin/delete-media/:id/:filename`, (req, res) => {
  const { id, filename } = req.params;
  let listings = readListings();

  const property = listings.find((l) => l.id === id);
  if (!property) return res.status(404).send("Property not found");

  // Hapus dari array media
  property.media = property.media.filter((m) => m.src !== filename);

  // Hapus file fisik (pastikan lokasi sesuai)
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  writeListings(listings);
  console.log(`🗑️ Media ${filename} dihapus dari properti ${id}`);

  res.redirect(`/${PATH_PROXY}/admin/form/${id}`);
});

// =====================================================
// 🚀 JALANKAN SERVER
// =====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}/${PATH_PROXY}`);
});
