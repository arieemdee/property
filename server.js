require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3400;

// --- Konfigurasi folder publik & view engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Fungsi bantu untuk baca data JSON ---
function loadListings() {
  const filePath = path.join(__dirname, 'data', 'listings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Gagal membaca listings.json:', err.message);
    return [];
  }
}

// --- Route Halaman Utama ---
app.get('/', (req, res) => {
  const { location, type, sort } = req.query;
  let listings = loadListings();

  // Filter lokasi
  if (location) {
    listings = listings.filter(item =>
      item.location.toLowerCase().includes(location.toLowerCase())
    );
  }

  // Filter tipe (house / car / lainnya)
  if (type) {
    listings = listings.filter(item => item.type === type);
  }

  // Urutkan berdasarkan harga
  if (sort === 'price_asc') {
    listings.sort((a, b) => a.price - b.price);
  } else if (sort === 'price_desc') {
    listings.sort((a, b) => b.price - a.price);
  }

  res.render('index', { listings, filters: { location, type, sort } });
});

// --- Jalankan server ---
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
