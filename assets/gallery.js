'use strict';

const FALLBACK_TITLE = 'Art Portfolio';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function validateManifest(data) {
  return !!data && data.schemaVersion === 1 && Array.isArray(data.artworks);
}

function siteInfo(manifest) {
  const site = manifest.site || {};
  return {
    title: site.title || FALLBACK_TITLE,
    bio: site.bio || null,
  };
}

function sortArtworks(artworks) {
  return artworks
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function formatDate(createdAt) {
  const match = /^(\d{4})-(\d{2})/.exec(createdAt || '');
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return MONTH_NAMES[monthIndex] + ' ' + match[1];
}

function columnCount(width) {
  if (width >= 900) return 3;
  if (width >= 600) return 2;
  return 1;
}

function distribute(items, columns) {
  const cols = [];
  for (let c = 0; c < columns; c += 1) cols.push([]);
  items.forEach((item, i) => {
    cols[i % columns].push(item);
  });
  return cols;
}

function buildCard(doc, artwork, onOpen) {
  const fig = doc.createElement('figure');
  fig.className = 'card';

  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'card-button';
  const label = artwork.title || 'Artwork ' + artwork.id;
  button.setAttribute('aria-label', 'View ' + label);

  const img = doc.createElement('img');
  img.src = artwork.image;
  img.setAttribute('loading', 'lazy');
  img.alt = label;
  button.appendChild(img);
  button.addEventListener('click', () => onOpen(button));
  fig.appendChild(button);

  const date = formatDate(artwork.createdAt);
  if (artwork.title || artwork.description || date) {
    const cap = doc.createElement('figcaption');
    if (artwork.title) {
      const h = doc.createElement('h2');
      h.className = 'card-title';
      h.textContent = artwork.title;
      cap.appendChild(h);
    }
    if (date) {
      const p = doc.createElement('p');
      p.className = 'card-date';
      p.textContent = date;
      cap.appendChild(p);
    }
    if (artwork.description) {
      const p = doc.createElement('p');
      p.className = 'card-desc';
      p.textContent = artwork.description;
      cap.appendChild(p);
    }
    fig.appendChild(cap);
  }
  return fig;
}

function renderGallery(doc, container, artworks, columns, onOpen) {
  container.innerHTML = '';
  const cards = artworks.map((artwork, index) =>
    buildCard(doc, artwork, (opener) => onOpen(index, opener))
  );
  distribute(cards, columns).forEach((columnCards) => {
    const columnEl = doc.createElement('div');
    columnEl.className = 'column';
    columnCards.forEach((card) => columnEl.appendChild(card));
    container.appendChild(columnEl);
  });
}

function showStatus(doc, container, message) {
  container.innerHTML = '';
  const p = doc.createElement('p');
  p.className = 'status';
  p.textContent = message;
  container.appendChild(p);
}

function applySiteInfo(doc, site) {
  doc.title = site.title;
  const titleEl = doc.getElementById('site-title');
  if (titleEl) titleEl.textContent = site.title;
  const bioEl = doc.getElementById('site-bio');
  if (bioEl) {
    if (site.bio) {
      bioEl.textContent = site.bio;
      bioEl.hidden = false;
    } else {
      bioEl.hidden = true;
    }
  }
}

function createLightbox(doc, artworks) {
  const root = doc.getElementById('lightbox');
  const img = doc.getElementById('lb-image');
  const titleEl = doc.getElementById('lb-title');
  const dateEl = doc.getElementById('lb-date');
  const descEl = doc.getElementById('lb-desc');
  const prevBtn = root.querySelector('.lb-prev');
  const nextBtn = root.querySelector('.lb-next');
  const closeBtn = root.querySelector('.lb-close');

  let current = -1;
  let opener = null;

  function setText(el, value) {
    el.textContent = value || '';
    el.hidden = !value;
  }

  function show(index) {
    current = index;
    const art = artworks[index];
    img.src = art.image;
    img.alt = art.title || 'Artwork ' + art.id;
    setText(titleEl, art.title);
    setText(dateEl, formatDate(art.createdAt));
    setText(descEl, art.description);
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === artworks.length - 1;
  }

  function open(index, openerEl) {
    opener = openerEl || null;
    root.hidden = false;
    doc.body.style.overflow = 'hidden';
    show(index);
    closeBtn.focus();
  }

  function close() {
    root.hidden = true;
    current = -1;
    doc.body.style.overflow = '';
    if (opener) {
      opener.focus();
      opener = null;
    }
  }

  function next() {
    if (current >= 0 && current < artworks.length - 1) show(current + 1);
  }

  function prev() {
    if (current > 0) show(current - 1);
  }

  function isOpen() {
    return !root.hidden;
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  closeBtn.addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  doc.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });

  return { open, close, next, prev, isOpen };
}

async function init(doc, win) {
  const container = doc.getElementById('gallery');
  try {
    const res = await win.fetch('manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!validateManifest(data)) throw new Error('Unsupported manifest version');
    applySiteInfo(doc, siteInfo(data));
    const validArtworks = data.artworks.filter(
      (a) => a && typeof a === 'object' && typeof a.image === 'string'
    );
    const artworks = sortArtworks(validArtworks);
    if (artworks.length === 0) {
      showStatus(doc, container, 'No artworks yet.');
      return;
    }
    const lightbox = createLightbox(doc, artworks);
    const onOpen = (index, opener) => lightbox.open(index, opener);
    let columns = columnCount(win.innerWidth);
    renderGallery(doc, container, artworks, columns, onOpen);
    win.addEventListener('resize', () => {
      const nextColumns = columnCount(win.innerWidth);
      if (nextColumns !== columns) {
        columns = nextColumns;
        renderGallery(doc, container, artworks, columns, onOpen);
      }
    });
  } catch (err) {
    showStatus(doc, container, 'Could not load the gallery: ' + err.message);
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    FALLBACK_TITLE,
    validateManifest,
    siteInfo,
    sortArtworks,
    formatDate,
    columnCount,
    distribute,
    buildCard,
    renderGallery,
    showStatus,
    applySiteInfo,
    createLightbox,
    init,
  };
} else if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => init(document, window));
}
