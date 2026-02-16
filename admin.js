// Admin dashboard for MongoDB backend
(async () => {
  const ADMIN_PASSWORD = 'admin123'; // change this to match .env ADMIN_PASSWORD

  const lockedEl = document.getElementById('locked');
  const dashEl = document.getElementById('dashboard');

  const pw = prompt('Enter admin password:');
  if (!pw || pw !== ADMIN_PASSWORD) {
    lockedEl.innerText = 'Access denied.';
    return;
  }

  lockedEl.classList.add('hidden');
  dashEl.classList.remove('hidden');

  async function fetchData() {
    try {
      const resp = await fetch(`/api/responses?password=${encodeURIComponent(ADMIN_PASSWORD)}`);
      if (!resp.ok) throw new Error('Network response not ok');
      const data = await resp.json();
      return data || [];
    } catch (err) {
      console.error('Fetch error', err);
      lockedEl.classList.remove('hidden');
      lockedEl.innerText = 'Failed to load data.';
      dashEl.classList.add('hidden');
      return [];
    }
  }

  async function fetchStats() {
    try {
      const resp = await fetch(`/api/stats?password=${encodeURIComponent(ADMIN_PASSWORD)}`);
      if (!resp.ok) throw new Error('Failed to fetch stats');
      const stats = await resp.json();
      return stats;
    } catch (err) {
      console.error('Stats fetch error', err);
      return null;
    }
  }

  function renderStats(stats) {
    if (!stats) return;

    document.getElementById('totalMembers').innerText = stats.totalMembers || 0;
    document.getElementById('avgPerformance').innerText = (stats.avgPerformance || 0) + '%';
    document.getElementById('highestScore').innerText = stats.highestScore || 0;
    document.getElementById('lowestScore').innerText = stats.lowestScore || 0;
  }

  function populateTable(rows) {
    const tbody = document.querySelector('#leaderboard tbody');
    tbody.innerHTML = '';

    rows.forEach(r => {
      const tr = document.createElement('tr');
      const d = new Date(r.timestamp || '');

      tr.innerHTML = `
        <td>${escapeHtml(r.name || '—')}</td>
        <td>${escapeHtml(String(r.score || '—'))}</td>
        <td>${escapeHtml(String(r.percentage || '—'))}%</td>
        <td>${isNaN(d) ? (r.timestamp || '') : d.toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Main
  const rows = await fetchData();
  const stats = await fetchStats();

  // Sort by percentage desc
  rows.sort((a, b) => (Number(b.percentage) || 0) - (Number(a.percentage) || 0));

  renderStats(stats);
  populateTable(rows);

})();
