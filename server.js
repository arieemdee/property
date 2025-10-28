require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

//helpers
const apiRouter = require('./routes/api');
const { readListings, writeListings } = require('./helpers/listings');
const { upload, UPLOAD_DIR } = require('./helpers/upload');
const { linkify } = require('./helpers/helpers');

const app = express();

// 🌐 Variabel global
const PATH_PROXY = process.env.PATH_PROXY || "nano";
const APP_TITLE = process.env.TITLE || "NANO Properti";

// 🧩 Middleware dasar
app.use(`/${PATH_PROXY}/api`, apiRouter);
//app.use(`/api`, apiRouter);
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

// Middleware untuk proteksi admin
function requireLogin(req, res, next) {
  if (!req.session?.username) return res.redirect(`/${PATH_PROXY}/login`);
  next();
}

// 🏠 HALAMAN UTAMA
app.get(`/${PATH_PROXY}`, (req, res) => {
  const filters = req.query;
  let listings = readListings();
  
  // Ambil nilai search dari query
  const search = filters.search;
  // Filter berdasarkan pencarian
  if (search) {
    listings = listings.filter(item => 
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    );
  }

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
    title: APP_TITLE,
    activePage: "home",
    PATH_PROXY,
    listings: paginated,
    filters,
    pagination: { currentPage: page, totalPages },
    linkify,
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
    title: "Login Admin",
    activePage: ""
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
    listings = readListings();
  } catch (err) {
    console.error(err);
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const perPage = 10; // jumlah properti per halaman
  const totalPages = Math.ceil(listings.length / perPage);
  const paginated = listings.slice((page - 1) * perPage, page * perPage);

  res.render("admin", {
    title: "Admin Properti",
    activePage: "admin",
    PATH_PROXY,
    listings: paginated,
    username: req.session.username,
    pagination: { currentPage: page, totalPages },
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
  const sold = req.body.sold === "on" || req.body.sold === "true" || req.body.sold === "1";
  const captions = req.body.captions ? req.body.captions.split("\n") : [];
  let listings = readListings();
  let property;

  const isPriority = ["house", "land"].includes(type?.toLowerCase());

  if (id) {
    // Edit data
    const idx = listings.findIndex(l => l.id.toString() === id);
    if (idx === -1) return res.redirect(`/${PATH_PROXY}/admin`);
    property = listings[idx];

    property.title = title;
    property.price = Number(price);
    property.type = type;
    property.location = location;
    property.contact = contact;
    property.description = description;
    property.sold = !!sold;

    if (req.files?.length > 0) {
      const newMedia = req.files.map((file, i) => ({
        type: file.mimetype.startsWith("video") ? "video" : "image",
        src: file.filename,
        caption: captions[i] || "",
      }));
      property.media = property.media || [];
      property.media.push(...newMedia);
    }

    // Hapus dulu dari posisi lama
    listings.splice(idx, 1);

    // Tambahkan ke posisi baru
    if (isPriority) {
      listings.unshift(property);
    } else {
      listings.push(property);
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
      sold: !!sold,
      createdAt: new Date().toISOString(),
      media: (req.files || []).map((file, i) => ({
        type: file.mimetype.startsWith("video") ? "video" : "image",
        src: file.filename,
        caption: captions[i] || "",
      })),
    };

    if (isPriority) {
      listings.unshift(property);
    } else {
      listings.push(property);
    }
  }

  writeListings(listings);
  console.log("✅ Properti disimpan:", property.title, "| Type:", property.type);
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

// 🗑️ HAPUS PROPERTI
app.get(`/${PATH_PROXY}/admin/delete/:id`, requireLogin, (req, res) => {
  const { id } = req.params;
  let listings = readListings();

  const propertyIndex = listings.findIndex((l) => l.id.toString() === id);
  if (propertyIndex === -1) return res.status(404).send("Property not found");

  const property = listings[propertyIndex];

  // Hapus semua file media terkait
  if (property.media && property.media.length > 0) {
    property.media.forEach((m) => {
      const filePath = path.join(UPLOAD_DIR, m.src);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  }

  // Hapus properti dari listings
  listings.splice(propertyIndex, 1);

  writeListings(listings);
  console.log(`🗑️ Properti ${id} dihapus`);

  res.redirect(`/${PATH_PROXY}/admin`);
});

// 🚀 Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}/${PATH_PROXY}`);
});
