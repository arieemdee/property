// api.js
const express = require('express');
const router = express.Router();
const { readListings, writeListings } = require('../helpers/listings');

router.post('/view/:id', (req, res) => {
  const id = req.params.id;

  try {
    const listings = readListings();
    const idx = listings.findIndex(it => String(it.id) === String(id));

    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const item = listings[idx];
    item.views = (item.views || 0) + 1;

    writeListings(listings);

    return res.json({ id: item.id, views: item.views });
  } catch (err) {
    console.error('view increment error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;