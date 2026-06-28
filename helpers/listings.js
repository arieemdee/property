// helpers/listings.js
const fs = require("fs");
const path = require("path");

const isPkg = typeof process.pkg !== "undefined";

// When packaged with `pkg`, files inside the snapshot are read-only.
// Use an external writable `data` directory next to the executable instead.
const externalBase = isPkg ? path.join(path.dirname(process.execPath), "data") : path.join(__dirname, "..", "data");
const DATA_FILE = path.join(externalBase, "listings.json");

let cacheListings = null;
let cacheTimestamp = 0;

// Ensure the external data directory exists
try {
  if (!fs.existsSync(externalBase)) fs.mkdirSync(externalBase, { recursive: true });
} catch (err) {
  console.error("❌ Error creating data directory:", err);
}

// If running from a pkg snapshot, copy the bundled data file out to the external location
if (isPkg) {
  const bundledFile = path.join(__dirname, "..", "data", "listings.json");
  try {
    if (!fs.existsSync(DATA_FILE)) {
      let content = "[]";
      try {
        content = fs.readFileSync(bundledFile, "utf8");
      } catch (e) {
        // fallback to empty array
      }
      fs.writeFileSync(DATA_FILE, content);
    }
  } catch (err) {
    console.error("❌ Error initializing external data file:", err);
  }
} else {
  // non-packaged: ensure file exists
  try {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
  } catch (err) {
    console.error("❌ Error creating data file:", err);
  }
}

function readListings() {
  try {
    const stats = fs.statSync(DATA_FILE);
    const fileModified = stats.mtimeMs;

    if (cacheListings && cacheTimestamp === fileModified) {
      return cacheListings;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    cacheListings = Array.isArray(data) ? data.map((item) => ({ ...item, sold: !!item.sold })) : [];
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
