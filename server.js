require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 3400;

// Konfigurasi folder upload
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Konfigurasi multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// 🔹 Helper function: read & write JSON
function readListings() {
  const file = path.join(__dirname, 'data', 'listings.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function saveListings(listings) {
  fs.writeFileSync(path.join(__dirname, 'data', 'listings.json'), JSON.stringify(listings, null, 2));
}

// =============================
// 🏡 1️⃣ Halaman utama (lihat properti)
// =============================
app.get('/', (req, res) => {
  const listings = readListings();

  const { location, type, sort } = req.query;
  let page = parseInt(req.query.page) || 1;

  // Filter & Sort
  let filtered = listings;
  if (location) filtered = filtered.filter(x => x.location.toLowerCase().includes(location.toLowerCase()));
  if (type) filtered = filtered.filter(x => x.type === type);
  if (sort === 'price_asc') filtered.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') filtered.sort((a, b) => b.price - a.price);

  // Pagination
  const pageSize = 6;
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (page > totalPages) page = totalPages;

  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  res.render('index', {
    listings: paginated,
    filters: { location, type, sort },
    pagination: { totalPages, totalItems, currentPage: page },
  });
});

// =============================
// ⚙️ 2️⃣ Admin Panel (CRUD UI)
// =============================
app.get('/admin', (req, res) => {
  const listings = readListings();
  res.render('admin', { listings });
});

// =============================
// ➕ 3️⃣ Tambah Properti
// =============================
app.post('/admin/add', upload.array('media', 10), (req, res) => {
  const listings = readListings();

  const { title, price, location, contact, type } = req.body;
  const media = req.files.map(file => ({
    type: file.mimetype.startsWith('video') ? 'video' : 'image',
    src: path.basename(file.path)
  }));

  const newListing = {
    id: Date.now(),
    title,
    price: Number(price),
    location,
    contact,
    type,
    media
  };

  listings.push(newListing);
  saveListings(listings);

  res.redirect('/admin');
});

// =============================
// ❌ 4️⃣ Hapus Properti
// =============================
app.post('/admin/delete/:id', (req, res) => {
  let listings = readListings();
  const id = parseInt(req.params.id);
  listings = listings.filter(l => l.id !== id);
  saveListings(listings);
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
