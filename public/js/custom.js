/*carousel*/ 
document.addEventListener('DOMContentLoaded', () => {
  if (typeof GLightbox === 'function') {
    GLightbox({
      selector: '.glightbox',
      touchNavigation: true,
      loop: true,
      zoomable: true,
      draggable: true,
    });
  }
});

// View Count API Hit
(function () {
  // gunakan PATH_PROXY yang disuntik di view, fallback 'nano'
  const pathProxy = (typeof window !== 'undefined' && window.PATH_PROXY) ? window.PATH_PROXY : 'nano';
  const proxyPrefix = pathProxy ? `/${pathProxy}` : '';
  const baseOrigin = `${location.origin}${proxyPrefix}`;

  async function hitViewApi(id) {
    if (!id) return;
    try {
      const url = `${baseOrigin}/api/view/${encodeURIComponent(id)}`;
      console.log('hitViewApi ->', url);
      const res = await fetch(url, { method: 'POST' });

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        console.error('view api error', res.status, body);
        return;
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        const text = await res.text().catch(() => '<no body>');
        console.error('view api returned non-json', text);
        return;
      }

      const data = await res.json();
      if (data && data.views !== undefined) {
        const el = document.querySelector(`.views-count[data-id="${id}"]`);
        if (el) el.textContent = data.views;
      }
    } catch (e) {
      console.error('hitViewApi error', e);
    }
  }

  // Delegated click: semua link gambar carousel menggunakan class .glightbox
  document.addEventListener('click', function (ev) {
    try {
      const a = ev.target && ev.target.closest ? ev.target.closest('a.glightbox') : null;
      if (!a) return;
      const card = a.closest && a.closest('.property-card');
      if (!card) return;
      const id = card.getAttribute('data-listing-id');
      if (id) hitViewApi(id);
    } catch (err) {
      console.error('click handler error', err);
    }
  }, true);
})();