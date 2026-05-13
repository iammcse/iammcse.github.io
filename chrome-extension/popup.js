// KSC hub - Popup Script

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function isTimeInRange(timeStr, startStr, endStr) {
  const t = timeToMinutes(timeStr);
  const s = timeToMinutes(startStr);
  const e = timeToMinutes(endStr);
  if (s <= e) return t >= s && t < e;
  return t >= s || t < e;
}

function getActiveRule(rules, date) {
  const time = date.toTimeString().slice(0, 5);
  const day = date.getDay();
  for (const rule of rules) {
    if (!rule.days.includes(day)) continue;
    if (isTimeInRange(time, rule.startTime, rule.endTime)) return rule;
  }
  return null;
}

function findNextTransition(rules, fromDate) {
  const now = fromDate || new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  let best = null;

  for (let d = 0; d <= 7; d++) {
    const base = new Date(now);
    base.setDate(base.getDate() + d);
    const checkDay = base.getDay();

    for (const rule of rules) {
      if (!rule.days.includes(checkDay)) continue;
      for (const timeStr of [rule.startTime, rule.endTime]) {
        const [h, m] = timeStr.split(':').map(Number);
        const mins = h * 60 + m;
        if (d === 0 && mins <= currentMin) continue;

        const candidate = new Date(base);
        candidate.setHours(h, m, 0, 0);
        if (!best || candidate < best) best = candidate;
      }
    }
  }
  return best;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date) {
  return date.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function render() {
  const content = document.getElementById('content');

  try {
    const stored = await chrome.storage.local.get('config');
    const config = stored.config || { rules: [] };
    const rules = config.rules || [];
    const now = new Date();
    const rule = getActiveRule(rules, now);
    const next = findNextTransition(rules, now);

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = DAY_NAMES[now.getDay()];

    let html = '';
    html += '<div class="info"><strong>Now</strong> ' + dayName + ' ' + formatTime(now) + '</div>';
    html += '<div class="info"><strong>Active Rule</strong> ' + (rule ? escapeHtml(rule.name) : '<em>None</em>') + '</div>';
    html += '<div class="info"><strong>Next Transition</strong> ' + (next ? formatDateTime(next) : '<em>None</em>') + '</div>';

    // Collect all referenced extension IDs
    const allIds = new Set();
    for (const r of rules) {
      for (const id of (r.extensions.enable || [])) { if (id.trim()) allIds.add(id.trim()); }
      for (const id of (r.extensions.disable || [])) { if (id.trim()) allIds.add(id.trim()); }
    }

    if (allIds.size > 0) {
      html += '<hr><div class="section-title">Monitored Extensions</div>';

      let extMap = {};
      try {
        const allExtensions = await chrome.management.getAll();
        for (const ext of allExtensions) extMap[ext.id] = ext;
      } catch (e) {
        // management API may fail silently; show IDs only
      }

      for (const id of allIds) {
        const ext = extMap[id];
        if (ext) {
          const cls = ext.enabled ? 'status-enabled' : 'status-disabled';
          const label = ext.enabled ? 'Enabled' : 'Disabled';
          html += '<div class="ext-item">' +
            '<span class="ext-name" title="' + escapeHtml(id) + '">' + escapeHtml(ext.name) + '</span>' +
            '<span class="ext-status ' + cls + '">' + label + '</span>' +
            '</div>';
        } else {
          html += '<div class="ext-item">' +
            '<span class="ext-name" title="' + escapeHtml(id) + '">' + escapeHtml(id) + '</span>' +
            '<span class="ext-status status-missing">Not found</span>' +
            '</div>';
        }
      }
    } else if (rules.length === 0) {
      html += '<hr><div class="empty">No rules configured.<br>Open Options to set up rules.</div>';
    } else {
      html += '<hr><div class="empty">No extension IDs in current rules.</div>';
    }

    content.innerHTML = html;
  } catch (e) {
    content.innerHTML = '<div class="error">' + escapeHtml(e.message) + '</div>';
  }
}

// --- Theme ---

const THEME_ICONS = { light: '☀️', dark: '🌙', auto: '◐' };
const THEME_LABELS = { light: 'Light mode', dark: 'Dark mode', auto: 'Auto (system)' };

let _themeMode = 'auto';
const _systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(mode) {
  if (mode === 'auto') return _systemDark.matches ? 'dark' : 'light';
  return mode;
}

async function initTheme() {
  const stored = await chrome.storage.local.get('theme');
  _themeMode = stored.theme || 'auto';
  document.documentElement.setAttribute('data-theme', resolveTheme(_themeMode));
  updateThemeToggle();
}

function updateThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = THEME_ICONS[_themeMode];
    btn.title = THEME_LABELS[_themeMode] + ' — click to switch';
  }
}

async function toggleTheme() {
  const modes = ['light', 'dark', 'auto'];
  const idx = modes.indexOf(_themeMode);
  const next = modes[(idx + 1) % 3];
  _themeMode = next;
  document.documentElement.setAttribute('data-theme', resolveTheme(next));
  updateThemeToggle();
  await chrome.storage.local.set({ theme: next });
}

_systemDark.addEventListener('change', () => {
  if (_themeMode === 'auto') {
    document.documentElement.setAttribute('data-theme', resolveTheme('auto'));
  }
});

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();

  render();

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  document.getElementById('btn-refresh').addEventListener('click', render);

  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('btn-apply').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'applyNow' }, () => {
      window.close();
    });
  });
});
