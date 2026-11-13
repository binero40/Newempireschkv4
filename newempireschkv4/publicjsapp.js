const API = window.location.origin;
let currentKey = localStorage.getItem('empires_key') || '';
let country = 'US';
let amazonType = 'normal';

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadKey();
  loadCookies();
  loadBins();
  bindEvents();
});

function loadKey() {
  const saved = localStorage.getItem('empires_key');
  if (saved) {
    document.getElementById('apiKey').value = saved;
  }
}

async function bindEvents() {
  document.getElementById('btnCheck').addEventListener('click', doCheck);
  document.getElementById('btnImportCookie').addEventListener('click', importCookie);
  document.getElementById('btnGenCards').addEventListener('click', generateCards);
  document.getElementById('btnDownloadLives').addEventListener('click', downloadLives);
  document.getElementById('btnDownloadDeads').addEventListener('click', downloadDeads);
  document.getElementById('countrySelect').addEventListener('change', (e) => {
    country = e.target.value;
  });
  document.getElementById('typeSelect').addEventListener('change', (e) => {
    amazonType = e.target.value;
  });
}

async function doCheck() {
  const cards = document.getElementById('cardsInput').value.trim();
  const cookie = document.getElementById('cookieInput').value.trim();
  const key = document.getElementById('apiKey').value.trim();

  if (!cards || !cookie || !key) {
    showStatus('Fill all fields (cards, cookie, API key)', 'error');
    return;
  }

  localStorage.setItem('empires_key', key);

  const cardList = cards.split('\n').filter(c => c.trim()).slice(0, 10);

  showStatus(`Checking ${cardList.length} cards via ${country}...`, 'info');
  setProgress(0);

  try {
    const res = await fetch(`${API}/api/checker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key
      },
      body: JSON.stringify({
        cards: cardList,
        cookie,
        country,
        amazonType
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || 'Error', 'error');
      return;
    }

    renderResults(data.results);
    showStatus(`Done! ${data.results.filter(r=>r.status==='LIVE').length} live, ${data.results.filter(r=>r.status==='DEAD').length} dead`, 'success');
    setProgress(100);

  } catch (err) {
    showStatus(err.message, 'error');
  }
}

function renderResults(results) {
  const liveEl = document.getElementById('liveResults');
  const deadEl = document.getElementById('deadResults');
  liveEl.innerHTML = '';
  deadEl.innerHTML = '';

  const flagMap = { US:'🇺🇸', MX:'🇲🇽', IT:'🇮🇹', FR:'🇫🇷', SG:'🇸🇬' };

  results.forEach(r => {
    const row = document.createElement('div');
    row.className = 'card-row';
    const countryFlag = flagMap[r.binInfo?.country] || '🌐';
    const statusClass = r.status === 'LIVE' ? 'badge-live' : r.status === 'DEAD' ? 'badge-dead' : 'badge-unknown';

    row.innerHTML = `
      <span class="flag">${countryFlag}</span>
      <span class="num">${r.card}</span>
      <span class="bin">BIN: ${r.binInfo?.bin || '???'}</span>
      <span class="bin">${r.binInfo?.brand || ''}</span>
      <span class="badge ${statusClass}">${r.status}</span>
      <small style="color:var(--text-dim)">${r.reason || ''}</small>
    `;

    if (r.status === 'LIVE') liveEl.appendChild(row);
    else deadEl.appendChild(row);
  });

  document.getElementById('liveCount').textContent = results.filter(r => r.status === 'LIVE').length;
  document.getElementById('deadCount').textContent = results.filter(r => r.status !== 'LIVE').length;
}

async function importCookie() {
  const cookie = document.getElementById('cookieImport').value.trim();
  const c = document.getElementById('importCountry').value;
  const key = document.getElementById('apiKey').value.trim();

  if (!cookie || !key) return showStatus('Need cookie and key', 'error');

  const res = await fetch(`${API}/api/cookies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({ country: c, data: cookie })
  });

  const data = await res.json();
  showStatus(data.status === 'imported' ? `Cookie imported for ${c}` : data.error, data.status === 'imported' ? 'success' : 'error');
}

async function generateCards() {
  const bin = document.getElementById('genBIN').value.trim();
  const count = parseInt(document.getElementById('genCount').value) || 1;
  const key = document.getElementById('apiKey').value.trim();

  if (!bin || !key) return showStatus('Need BIN and key', 'error');

  const res = await fetch(`${API}/api/generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({ bin, count })
  });

  const data = await res.json();
  if (!res.ok) return showStatus(data.error, 'error');

  const out = document.getElementById('genOutput');
  out.value = data.cards.map(c => `${c.number}|${c.expiry}|${c.cvv}`).join('\n');
  showStatus(`Generated ${data.generated} cards (BIN ${bin})`, 'success');
}

async function loadCookies() {
  const key = document.getElementById('apiKey')?.value;
  if (!key) return;

  const res = await fetch(`${API}/api/cookies?key=${key}`);
  const data = await res.json();
  // Could populate a dropdown here
}

async function loadBins() {
  const key = document.getElementById('apiKey')?.value;
  if (!key) return;

  try {
    const res = await fetch(`${API}/api/generator/bins?key=${key}`);
    const data = await res.json();
    const select = document.getElementById('genBIN');
    // Keep as free input but show hint
    if (data.bins?.length) {
      const hint = document.getElementById('binHint');
      if (hint) hint.textContent = `Available: ${data.bins.slice(0, 8).map(b => b.bin).join(', ')}...`;
    }
  } catch(e) {}
}

function downloadLives() {
  const key = document.getElementById('apiKey').value;
  window.location = `${API}/api/checker/download?status=LIVE&key=${key}`;
}

function downloadDeads() {
  const key = document.getElementById('apiKey').value;
  window.location = `${API}/api/checker/download?status=DEAD&key=${key}`;
}

function showStatus(msg, type) {
  const el = document.getElementById('statusBar');
  el.textContent = msg;
  el.className = 'status-' + type;
  el.style.color = type === 'success' ? 'var(--neon-green)' : type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)';
}

function setProgress(pct) {
  const fill = document.querySelector('.progress-bar .fill');
  if (fill) fill.style.width = pct + '%';
}