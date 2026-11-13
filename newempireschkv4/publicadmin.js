const API = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
  // Secret from URL or prompt
  let secret = new URLSearchParams(window.location.search).get('secret');
  if (!secret) {
    secret = prompt('Enter admin secret:');
    if (!secret) window.location = '/';
  }
  localStorage.setItem('empires_admin_secret', secret);

  loadStats();
  loadKeys();

  document.getElementById('btnGenKey').addEventListener('click', generateKey);
});

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': localStorage.getItem('empires_admin_secret')
  };
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/api/admin/stats`, { headers: headers() });
    const d = await res.json();
    document.getElementById('statLives').textContent = d.lives;
    document.getElementById('statDeads').textContent = d.deads;
    document.getElementById('statKeys').textContent = d.active_keys;
    document.getElementById('statChecks').textContent = d.total_checks;
  } catch(e) { console.error(e); }
}

async function loadKeys() {
  try {
    const res = await fetch(`${API}/api/admin/keys`, { headers: headers() });
    const d = await res.json();
    const tbody = document.getElementById('keysTable');
    tbody.innerHTML = '';

    d.keys.forEach(k => {
      const tr = document.createElement('tr');
      const statusBadge = k.is_active ? '<span class="badge badge-live">Active</span>' : '<span class="badge badge-dead">Revoked</span>';
      tr.innerHTML = `
        <td>${k.key}</td>
        <td>${k.label || '-'}</td>
        <td>${new Date(k.valid_until).toLocaleDateString()}</td>
        <td>${k.checks_used} / ${k.max_checks}</td>
        <td>${statusBadge}</td>
        <td><button class="btn btn-danger btn-sm" onclick="revokeKey(${k.id})">✕</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error(e); }
}

async function generateKey() {
  const days = document.getElementById('keyDays').value;
  const maxChecks = document.getElementById('keyMaxChecks').value;
  const label = document.getElementById('keyLabel').value;

  const res = await fetch(`${API}/api/admin/keys`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ days: parseInt(days), maxChecks: parseInt(maxChecks), label })
  });

  const d = await res.json();
  document.getElementById('genKeyOutput').innerHTML = `
    <strong>✅ Key generated:</strong><br>
    <code style="color:var(--neon-green); font-size:1.1rem;">${d.key}</code><br>
    Expires: ${new Date(d.expires).toLocaleDateString()} · Max: ${d.maxChecks} checks
  `;

  loadKeys();
  loadStats();
}

async function revokeKey(id) {
  if (!confirm('Revoke this key?')) return;
  await fetch(`${API}/api/admin/keys/${id}`, { method: 'DELETE', headers: headers() });
  loadKeys();
  loadStats();
}