require("dotenv").config(); // 🧩 Load variabel dari .env

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const session = require("express-session");

const app = express();
const router = express.Router();

// 📦 Variabel dari .env (pakai nilai default jika belum di-set)
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "rahasia-super-admin";
const PATH_PROXY = process.env.PATH_PROXY || "nano"

// 📁 Lokasi file JSON
const DATA_FILE = path.join(__dirname, "data", "listings.json");

// 🧩 Setup middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mount router di /nano
app.use(`/${PATH_PROXY}`, router);

// 🔗 Static file serving
app.use(express.static(path.join(__dirname, "public")));
app.use(`/${PATH_PROXY}/uploads`, express.static(path.join(__dirname, "public", "uploads")));
app.use(`/${PATH_PROXY}/css`, express.static(path.join(__dirname, "public", "css")));
app.use(`/${PATH_PROXY}/js`, express.static(path.join(__dirname, "public", "js")));

// 🧠 Session untuk login admin
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// 📸 Konfigurasi upload media
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "public", "uploads")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// 📖 Fungsi bantu
function readData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===================
// 🔐 LOGIN ADMIN
// ===================
app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.isAdmin = true;
    res.redirect(`/${PATH_PROXY}/admin`);
  } else {
    res.render("login", { error: "Username atau password salah" });
  }
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

// 🔒 Middleware proteksi admin
function requireLogin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect(`/${PATH_PROXY}/admin`);
  next();
}

// ===================
// 🏠 HALAMAN UTAMA
// ===================
app.get("/", (req, res) => {
  let { location = "", type = "", sort = "", page = 1 } = req.query;
  let listings = readData(); // harus let, karena akan difilter

  // 🔹 Filter lokasi
  if (location.trim() !== "") {
    listings = listings.filter(item =>
      item.location.toLowerCase().includes(location.toLowerCase())
    );
  }

  // 🔹 Filter tipe
  if (type.trim() !== "") {
    listings = listings.filter(item => item.type === type);
  }

  // 🔹 Sort harga
  if (sort === "price_asc") {
    listings.sort((a, b) => a.price - b.price);
  } else if (sort === "price_desc") {
    listings.sort((a, b) => b.price - a.price);
  }

  // 🔹 Pagination
  page = parseInt(page) || 1;
  const perPage = 6;
  const start = (page - 1) * perPage;
  const paginatedData = listings.slice(start, start + perPage);

  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(listings.length / perPage),
  };

  res.render("index", {
    listings: paginatedData,
    pagination,
    filters: { location, type, sort },
    PATH_PROXY
  });
});


// ===================
// 🧰 ADMIN PANEL
// ===================
app.get("/admin", requireLogin, (req, res) => {
  const listings = readData();
  res.render("admin", { listings, PATH_PROXY });
});

app.get("/admin/new", requireLogin, (req, res) =>
  res.render("admin-form", { item: null, PATH_PROXY })
);

app.get("/admin/edit/:id", requireLogin, (req, res) => {
  const listings = readData();
  const item = listings.find(x => x.id == req.params.id);
  res.render("admin-form", { item, PATH_PROXY });
});

// 💾 Tambah/edit properti
app.post("/admin/save", requireLogin, upload.array("media"), (req, res) => {
  const listings = readData();
  const { id, title, price, location, type, contact, description, captions } =
    req.body;

  const captionArray = captions ? captions.split("\n").map((c) => c.trim()) : [];

  let media = [];
  if (req.files?.length) {
    media = req.files.map((file, i) => ({
      type: file.mimetype.startsWith("video") ? "video" : "image",
      src: file.filename,
      caption: captionArray[i] || "",
    }));
  }

  if (id) {
    // Update data lama
    const idx = listings.findIndex((x) => x.id == id);
    if (idx !== -1) {
      listings[idx] = {
        ...listings[idx],
        title,
        price: Number(price),
        location,
        type,
        contact,
        description,
        media: media.length ? media : listings[idx].media,
      };
    }
  } else {
    // Tambah baru
    listings.push({
      id: Date.now(),
      title,
      price: Number(price),
      location,
      type,
      contact,
      description,
      media,
    });
  }

  writeData(listings);
  res.redirect(`/${PATH_PROXY}/admin`);
});

// ❌ Hapus properti
app.post("/admin/delete/:id", requireLogin, (req, res) => {
  let listings = readData();
  listings = listings.filter(x => x.id != req.params.id);
  writeData(listings);
  res.redirect(`/${PATH_PROXY}/admin`);
});

// ===================
// 🚀 Jalankan server
// ===================
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
