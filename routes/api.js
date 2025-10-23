const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const listingsPath = path.resolve(__dirname, '..', 'data', 'listings.json');

router.post('/view/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const raw = await fs.readFile(listingsPath, 'utf8');
    const list = JSON.parse(raw);
    const idx = list.findIndex(it => String(it.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const item = list[idx];
    item.views = (item.views || 0) + 1;

    await fs.writeFile(listingsPath, JSON.stringify(list, null, 2), 'utf8');

    return res.json({ id: item.id, views: item.views });
  } catch (err) {
    console.error('view increment error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;