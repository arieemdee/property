// ===== linkify global + cache (letakkan sebelum route) =====
const linkifyCache = new Map();

/**
 * Ubah teks menjadi versi HTML dengan link aktif dan aman dari XSS
 * @param {string} text - Teks mentah yang ingin diubah menjadi link
 * @returns {string} - Teks dalam format HTML (dengan <a> dan <br>)
*/

function linkify(text) {
  if (!text) return '';

  // cek cache
  if (linkifyCache.has(text)) return linkifyCache.get(text);

  // escape HTML untuk mencegah XSS
  let safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // ubah newline jadi <br>
  safe = safe.replace(/\r\n|\r|\n/g, '<br>');

  // regex untuk https/http/www/domains
  const urlRegex = /\b((https?:\/\/)|(www\.))([^\s<]+)/gi;

  const linked = safe.replace(urlRegex, (match) => {
    let url = match;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const visible = match.replace(/^https?:\/\//i, '');
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${visible}</a>`;
  });

  // limit cache (mis. max 500 entries)
  if (linkifyCache.size >= 500) {
    const firstKey = linkifyCache.keys().next().value;
    linkifyCache.delete(firstKey);
  }

  linkifyCache.set(text, linked);
  return linked;
}

// Optional: buat helper global untuk semua EJS tanpa perlu kirim setiap res.render
// app.locals.linkify = linkify;

module.exports = { linkify };