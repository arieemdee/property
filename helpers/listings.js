// helpers/listings.js
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "listings.json");

let cacheListings = null;
let cacheTimestamp = 0;

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

function readListings() {
  try {
    const stats = fs.statSync(DATA_FILE);
    const fileModified = stats.mtimeMs;

    if (cacheListings && cacheTimestamp === fileModified) {
      return cacheListings;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    cacheListings = Array.isArray(data)
      ? data.map((item) => ({ ...item, sold: !!item.sold }))
      : [];
    cacheTimestamp = fileModified;

    return cacheListings;
  } catch (err) {
    if (err.code === "ENOENT") {
      cacheListings = [];
      cacheTimestamp = Date.now();
      return [];
    }
    console.error("❌ Error readListings:", err);
    return [];
  }
}

function writeListings(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    cacheListings = data;
    cacheTimestamp = fs.statSync(DATA_FILE).mtimeMs;
  } catch (err) {
    console.error("❌ Error writeListings:", err);
  }
}

module.exports = { readListings, writeListings };
