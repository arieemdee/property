require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

// 🌐 Variabel global
const PATH_PROXY = process.env.PATH_PROXY || "nano";
const DATA_FILE = path.join(__dirname, "data", "listings.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

// 🧩 Middleware dasar
app.use(`/${PATH_PROXY}`, express.static(path.join(__dirname, "public")));
app.use(`/${PATH_PROXY}/uploads`, express.static(UPLOAD_DIR));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 🧠 Session untuk login admin
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 jam
  })
);

// ⚙️ View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 📁 Pastikan folder penting ada
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// 📚 Fungsi bantu
function readListings() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeListings(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 🧩 Konfigurasi upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Middleware untuk proteksi admin
function requireLogin(req, res, next) {
  if (!req.session?.username) return res.redirect(`/${PATH_PROXY}/login`);
  next();
}

// 🏠 HALAMAN UTAMA
app.get(`/${PATH_PROXY}`, (req, res) => {
  const filters = req.query;
  let listings = readListings();

  // Filter lokasi
  if (filters.location)
    listings = listings.filter((x) =>
      x.location.toLowerCase().includes(filters.location.toLowerCase())
    );

  // Filter tipe
  if (filters.type) listings = listings.filter((x) => x.type === filters.type);

  // Sort harga
  if (filters.sort === "price_asc") listings.sort((a, b) => a.price - b.price);
  if (filters.sort === "price_desc") listings.sort((a, b) => b.price - a.price);

  // Pagination
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

// 🔐 LOGIN - GET
app.get(`/${PATH_PROXY}/login`, (req, res) => {
  res.render("login", {
    title: "Login Admin",
    activePage: "",
    PATH_PROXY,
    error: null,
  });
});

app.post(`/${PATH_PROXY}/login`, (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.username = username;  // ✅ simpan session
    console.log("✅ Login berhasil:", username);
    return res.redirect(`/${PATH_PROXY}/admin`);  // ✅ arahkan ke admin
  }
  res.render("login", {
    PATH_PROXY,
    error: "Username atau password salah",
  });
});

// 🚪 LOGOUT
app.get(`/${PATH_PROXY}/logout`, (req, res) => {
  req.session.destroy(() => {
    res.redirect(`/${PATH_PROXY}/login`);
  });
});

app.get(`/${PATH_PROXY}/admin`, requireLogin, (req, res) => {
  let listings = [];
  try {
    listings = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error(err);
  }

  res.render("admin", {
    title: "Admin Properti",
    activePage: "admin",
    PATH_PROXY,
    listings,
    username: req.session.username
  });
});

app.get(`/${PATH_PROXY}/admin/form/:id?`, requireLogin, (req, res) => {
  const id = req.params.id;
  const listings = readListings();
  const property = listings.find(l => l.id.toString() === id) || null;

  res.render("admin-form", {
    title: property ? "Edit Properti" : "Tambah Properti",
    activePage: "admin",
    PATH_PROXY,
    property,
  });
});

// 💾 SIMPAN / UPDATE PROPERTI
app.post(`/${PATH_PROXY}/admin/save`, requireLogin, upload.array("media", 10), (req, res) => {
  const { id, title, price, type, location, contact, description } = req.body;
  const captions = req.body.captions ? req.body.captions.split("\n") : [];
  let listings = readListings();
  let property;

  if (id) {
    // Edit mode
    property = listings.find(l => l.id.toString() === id);
    if (!property) return res.redirect(`/${PATH_PROXY}/admin`);

    // Update properti
    property.title = title;
    property.price = Number(price);
    property.type = type;
    property.location = location;
    property.contact = contact;
    property.description = description;

    // Tambah media baru
    if (req.files?.length > 0) {
      const newMedia = req.files.map((file, i) => ({
        type: file.mimetype.startsWith("video") ? "video" : "image",
        src: file.filename,
        caption: captions[i] || "",
      }));
      property.media.push(...newMedia);
    }
  } else {
    // Tambah baru
    property = {
      id: Date.now().toString(),
      title,
      price: Number(price),
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

// 🗑️ HAPUS MEDIA
app.get(`/${PATH_PROXY}/admin/delete-media/:id/:filename`, requireLogin, (req, res) => {
  const { id, filename } = req.params;
  const listings = readListings();
  const property = listings.find(l => l.id.toString() === id);
  if (!property) return res.status(404).send("Property not found");

  // Hapus media dari property
  property.media = property.media.filter((m) => m.src !== filename);

  // Hapus file dari folder uploads
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Simpan perubahan ke JSON
  writeListings(listings);
  console.log(`🗑️ Media ${filename} dihapus dari properti ${id}`);

  // Redirect kembali ke form edit properti
  res.redirect(`/${PATH_PROXY}/admin/form/${id}`);
});


// 🚀 Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}/${PATH_PROXY}`);
});
