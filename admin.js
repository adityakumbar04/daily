(() => {
  const TOKEN_KEY = 'adminToken';
  const USER_KEY = 'adminUser';
  const NUM_QUESTIONS = 18;
  const API_BASE = (() => {
    // If you're running the HTML from a static dev server (e.g. :5500),
    // POST /api/* will hit that server and often returns 405.
    // In that case, point API calls to the backend on :3000.
    const host = String(location.hostname || '').toLowerCase();
    const port = String(location.port || '');
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalHost && port && port !== '3000') return 'http://localhost:3000';
    return '';
  })();

  const authView = document.getElementById('authView');
  const appView = document.getElementById('appView');

  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const clearSessionBtn = document.getElementById('clearSessionBtn');
  const loginStatus = document.getElementById('loginStatus');

  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const appStatus = document.getElementById('appStatus');
  const userChip = document.getElementById('userChip');

  const tableMeta = document.getElementById('tableMeta');

  let reportDays = [];
  let reportOverall = null;

  function setStatus(el, msg, isError = false) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function setView(view) {
    if (view === 'app') {
      authView.classList.add('hidden');
      appView.classList.remove('hidden');
    } else {
      appView.classList.add('hidden');
      authView.classList.remove('hidden');
    }
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession({ token, username }) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, username || '');
    if (username) {
      userChip.textContent = `Signed in as ${username}`;
      userChip.classList.remove('hidden');
    } else {
      userChip.classList.add('hidden');
    }
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    userChip.classList.add('hidden');
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiFetchJson(url, options = {}) {
    const resp = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...authHeaders()
      }
    });

    if (resp.status === 401) {
      // If we're already on the login call, 401 means invalid credentials.
      if (url !== '/api/admin/login') {
        clearSession();
        setView('auth');
        setStatus(loginStatus, 'Session expired. Please sign in again.', true);
      }
      throw new Error('Unauthorized');
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `Request failed (${resp.status})`);
    }

    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) return resp.json();
    const text = await resp.text();
    return text;
  }

  async function login(username, password) {
    setStatus(loginStatus, 'Signing in...');
    loginBtn.disabled = true;
    try {
      const data = await apiFetchJson(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!data || !data.token) throw new Error('Invalid login response');
      setSession({ token: data.token, username: data.username || username });
      setView('app');
      setStatus(loginStatus, '');
      await refreshAll();
    } catch (e) {
      console.error('Login error', e);
      const msg = String(e && e.message ? e.message : '');
      if (msg === 'Unauthorized') {
        setStatus(loginStatus, 'Invalid username or password.', true);
      } else if (msg) {
        setStatus(loginStatus, `Login failed: ${msg}`, true);
      } else {
        setStatus(loginStatus, 'Login failed. Please try again.', true);
      }
      throw e;
    } finally {
      loginBtn.disabled = false;
    }
  }

  function toIsoDate(d) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  async function fetchReport(start, end) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const qs = params.toString();
    return apiFetchJson(`${API_BASE}/api/report${qs ? `?${qs}` : ''}`, { method: 'GET', headers: {} });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function populateTable(days) {
    const tbody = document.querySelector('#leaderboard tbody');
    tbody.innerHTML = '';

    days.forEach(day => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(day.date || '—')}</td>
        <td class="right">${escapeHtml(String(day.total ?? 0))}</td>
        ${Array.from({ length: NUM_QUESTIONS }).map((_, i) => {
          const yes = (day.yes && day.yes[i]) ? day.yes[i] : 0;
          const total = day.total || 0;
          const pct = total ? Math.round((yes / total) * 100) : 0;
          return `<td class="right" title="${escapeHtml(`Q${i + 1}: ${yes}/${total} (${pct}%)`)}">${escapeHtml(`${yes}/${total}`)}</td>`;
        }).join('')}
      `;
      tbody.appendChild(tr);
    });
  }

  function renderOverview(overall, start, end) {
    const totalResponses = overall && typeof overall.totalResponses === 'number' ? overall.totalResponses : 0;
    const yesTotal = overall && typeof overall.yesTotal === 'number' ? overall.yesTotal : 0;
    const answerTotal = overall && typeof overall.answerTotal === 'number' ? overall.answerTotal : 0;
    const yesRate = answerTotal ? Math.round((yesTotal / answerTotal) * 100) : 0;

    document.getElementById('totalMembers').innerText = totalResponses.toLocaleString();
    document.getElementById('avgPerformance').innerText = answerTotal ? `${yesRate}%` : '—';

    const yesByQ = (overall && Array.isArray(overall.yesByQuestion)) ? overall.yesByQuestion : Array(NUM_QUESTIONS).fill(0);
    const denom = totalResponses || 0;
    const rates = yesByQ.map(v => denom ? (v / denom) : 0);

    let maxI = -1, minI = -1;
    rates.forEach((r, i) => {
      if (denom === 0) return;
      if (maxI === -1 || r > rates[maxI]) maxI = i;
      if (minI === -1 || r < rates[minI]) minI = i;
    });

    if (denom === 0) {
      document.getElementById('highestScore').innerText = '—';
      document.getElementById('lowestScore').innerText = '—';
    } else {
      document.getElementById('highestScore').innerText = `Q${maxI + 1} (${Math.round(rates[maxI] * 100)}%)`;
      document.getElementById('lowestScore').innerText = `Q${minI + 1} (${Math.round(rates[minI] * 100)}%)`;
    }

    setStatus(appStatus, `Report ${start} → ${end}`);
  }

  function updateTableMeta(visibleCount, totalCount) {
    if (!tableMeta) return;
    tableMeta.textContent = `${visibleCount.toLocaleString()} days shown • ${totalCount.toLocaleString()} days total`;
  }

  function toCsvValue(v) {
    const s = String(v ?? '');
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  }

  function exportCsv(days) {
    const header = ['Date', 'Total', ...Array.from({ length: NUM_QUESTIONS }).map((_, i) => `Q${i + 1} Yes/Total`)];
    const lines = [header.map(toCsvValue).join(',')];
    days.forEach(day => {
      const row = [
        day.date,
        day.total,
        ...Array.from({ length: NUM_QUESTIONS }).map((_, i) => {
          const yes = (day.yes && day.yes[i]) ? day.yes[i] : 0;
          const total = day.total || 0;
          return `${yes}/${total}`;
        })
      ];
      lines.push(row.map(toCsvValue).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderTable() {
    populateTable(reportDays);
    updateTableMeta(reportDays.length, reportDays.length);
  }

  async function refreshAll() {
    setStatus(appStatus, 'Loading…');
    refreshBtn.disabled = true;
    exportBtn.disabled = true;
    try {
      const data = await fetchReport('', '');

      reportDays = Array.isArray(data && data.days) ? data.days.slice() : [];
      reportOverall = (data && data.overall) ? data.overall : null;

      renderOverview(reportOverall, data && data.start ? data.start : '', data && data.end ? data.end : '');
      renderTable();
      setStatus(appStatus, `Last updated ${new Date().toLocaleString()}`);
    } catch (e) {
      console.error('Refresh error', e);
      const raw = String(e && e.message ? e.message : '');
      let msg = raw;
      if (msg.startsWith('<!DOCTYPE html>') || msg.includes('Cannot GET /api/report')) {
        msg = 'Report endpoint not found. Restart the backend (`npm start`) to load the latest routes.';
      } else if (raw.length > 220) {
        msg = raw.slice(0, 220) + '…';
      } else if (!msg) {
        msg = 'Unknown error';
      }
      setStatus(appStatus, `Failed to load data: ${msg}`, true);
    } finally {
      refreshBtn.disabled = false;
      exportBtn.disabled = false;
    }
  }

  // Events
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
      setStatus(loginStatus, 'Please enter username and password.', true);
      return;
    }
    await login(username, password);
  });

  clearSessionBtn.addEventListener('click', () => {
    clearSession();
    setStatus(loginStatus, 'Session cleared. Please sign in.', false);
  });

  logoutBtn.addEventListener('click', () => {
    clearSession();
    setView('auth');
    setStatus(loginStatus, 'Signed out.', false);
  });

  refreshBtn.addEventListener('click', refreshAll);

  exportBtn.addEventListener('click', () => {
    exportCsv(reportDays);
  });

  // Boot
  if (location && location.protocol === 'file:') {
    setStatus(loginStatus, 'This page is opened via file://. Run the site (e.g. `npm start`) and open `http://localhost:3000/admin.html` so `/api/*` works.', true);
  }

  const existingToken = getToken();
  if (existingToken) {
    const u = sessionStorage.getItem(USER_KEY) || '';
    if (u) {
      userChip.textContent = `Signed in as ${u}`;
      userChip.classList.remove('hidden');
    }
    setView('app');
    refreshAll();
  } else {
    setView('auth');
    if (!(location && location.protocol === 'file:')) setStatus(loginStatus, '');
  }
})();
