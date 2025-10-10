require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3400;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  try {
    // Baca data dari listings.json
    const rawData = fs.readFileSync(path.join(__dirname, 'data', 'listings.json'), 'utf-8');
    let listings = JSON.parse(rawData);

    // Ambil query filter
    const { location, type, sort } = req.query;
    let page = parseInt(req.query.page) || 1;

    // 🔍 Filter lokasi
    if (location) {
      listings = listings.filter(item =>
        item.location.toLowerCase().includes(location.toLowerCase())
      );
    }

    // 🔍 Filter tipe
    if (type) {
      listings = listings.filter(item => item.type === type);
    }

    // 🔽 Sort harga
    if (sort === 'price_asc') {
      listings.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      listings.sort((a, b) => b.price - a.price);
    }

    // 📄 Pagination setup
    const pageSize = 6;
    const totalItems = listings.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize)); // selalu minimal 1
    if (page > totalPages) page = totalPages;

    const startIndex = (page - 1) * pageSize;
    const paginatedListings = listings.slice(startIndex, startIndex + pageSize);

    res.render('index', {
      listings: paginatedListings,
      filters: { location, type, sort },
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
      },
    });

  } catch (err) {
    console.error('Error reading listings.json:', err);
    res.status(500).send('Server error loading listings.');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
