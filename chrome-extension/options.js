// KSC hub - Options Page Script

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_CONFIG = {
  rules: [
    {
      name: 'Work Hours',
      startTime: '09:00',
      endTime: '17:00',
      days: [1, 2, 3, 4, 5],
      extensions: { enable: [], disable: [] },
      startupTabs: []
    },
    {
      name: 'Personal Time',
      startTime: '17:00',
      endTime: '09:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      extensions: { enable: [], disable: [] },
      startupTabs: []
    }
  ]
};

async function loadConfig() {
  const stored = await chrome.storage.local.get('config');
  return stored.config || DEFAULT_CONFIG;
}

async function saveConfig(config) {
  await chrome.storage.local.set({ config });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function createRuleCard(rule, index) {
  const card = document.createElement('div');
  card.className = 'rule-card';
  card.dataset.index = index;

  card.innerHTML = `
    <div class="rule-header">
      <input type="text" class="rule-name" value="${escapeHtml(rule.name)}" placeholder="Rule Name" required>
      <button type="button" class="btn-delete" title="Delete rule">&times;</button>
    </div>
    <div class="rule-row">
      <label>From <input type="time" class="rule-start" value="${rule.startTime}" required></label>
      <label>To <input type="time" class="rule-end" value="${rule.endTime}" required></label>
    </div>
    <div class="rule-days">
      ${DAYS.map((day, i) => `
        <label><input type="checkbox" class="rule-day" value="${i}" ${rule.days.includes(i) ? 'checked' : ''}> ${day}</label>
      `).join('')}
    </div>
    <details>
      <summary>Extensions to Enable <span class="hint">(one ID per line)</span></summary>
      <textarea class="rule-enable" rows="2" placeholder="Extension IDs to enable during this rule">${escapeHtml((rule.extensions.enable || []).join('\n'))}</textarea>
    </details>
    <details>
      <summary>Extensions to Disable <span class="hint">(one ID per line)</span></summary>
      <textarea class="rule-disable" rows="2" placeholder="Extension IDs to disable during this rule">${escapeHtml((rule.extensions.disable || []).join('\n'))}</textarea>
    </details>
    <details>
      <summary>Startup Tabs <span class="hint">(one URL per line, opened on Chrome startup)</span></summary>
      <textarea class="rule-tabs" rows="2" placeholder="https://example.com">${escapeHtml((rule.startupTabs || []).join('\n'))}</textarea>
    </details>
  `;

  card.querySelector('.btn-delete').addEventListener('click', () => card.remove());
  return card;
}

function renderRules(rules) {
  const container = document.getElementById('rules-container');
  container.innerHTML = '';
  rules.forEach((rule, i) => container.appendChild(createRuleCard(rule, i)));
}

function collectRules() {
  const cards = document.querySelectorAll('.rule-card');
  const rules = [];

  cards.forEach(card => {
    const name = card.querySelector('.rule-name').value.trim();
    const startTime = card.querySelector('.rule-start').value;
    const endTime = card.querySelector('.rule-end').value;

    const days = Array.from(card.querySelectorAll('.rule-day:checked'))
      .map(cb => parseInt(cb.value))
      .sort((a, b) => a - b);

    const enable = card.querySelector('.rule-enable').value
      .split('\n').map(s => s.trim()).filter(Boolean);

    const disable = card.querySelector('.rule-disable').value
      .split('\n').map(s => s.trim()).filter(Boolean);

    const startupTabs = card.querySelector('.rule-tabs').value
      .split('\n').map(s => s.trim()).filter(Boolean);

    rules.push({
      name: name || 'Rule ' + (rules.length + 1),
      startTime,
      endTime,
      days,
      extensions: { enable, disable },
      startupTabs
    });
  });

  return rules;
}

// --- Import / Export ---

async function exportConfig() {
  const config = await loadConfig();
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'KSC_Hub_settings.config';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('Settings exported as KSC_Hub_settings.config.', false);
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const config = JSON.parse(e.target.result);

      if (!config.rules || !Array.isArray(config.rules)) {
        showStatus('Invalid file: missing "rules" array.', true);
        return;
      }

      for (const rule of config.rules) {
        if (!rule.name || !rule.startTime || !rule.endTime || !Array.isArray(rule.days)) {
          showStatus('Invalid file: one or more rules are malformed.', true);
          return;
        }
      }

      await saveConfig(config);
      renderRules(config.rules);
      showStatus('Imported ' + config.rules.length + ' rule(s). Saved.', false);
    } catch (err) {
      showStatus('Cannot parse file: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

function showStatus(message, isError) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = isError ? 'status-error' : 'status-success';
  if (!isError) {
    setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
  }
}

// --- Theme ---

const THEME_ICONS = { light: '☀️', dark: '🌙', auto: '◐' };
const THEME_LABELS = { light: 'Light mode', dark: 'Dark mode', auto: 'Auto (system)' };

let _themeMode = 'auto';
let _systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(mode) {
  if (mode === 'auto') return _systemDark.matches ? 'dark' : 'light';
  return mode;
}

async function initTheme() {
  const stored = await chrome.storage.local.get('theme');
  _themeMode = stored.theme || 'auto';
  applyTheme(_themeMode);
  updateThemeToggle();
}

function applyTheme(mode) {
  _themeMode = mode;
  document.documentElement.setAttribute('data-theme', resolveTheme(mode));
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
  applyTheme(next);
  updateThemeToggle();
  await chrome.storage.local.set({ theme: next });
}

// React to system theme changes when in auto mode
_systemDark.addEventListener('change', () => {
  if (_themeMode === 'auto') {
    document.documentElement.setAttribute('data-theme', resolveTheme('auto'));
  }
});

// --- Auth UI helpers ---

function updateAuthUI() {
  const state = authGetState();
  const loggedOutEl = document.getElementById('auth-logged-out');
  const loggedInEl = document.getElementById('auth-logged-in');

  if (state.isLoggedIn) {
    loggedOutEl.hidden = true;
    loggedInEl.hidden = false;
    document.getElementById('auth-avatar').src = state.user.picture || state.user.avatar_url || '';
    document.getElementById('auth-avatar').alt = state.user.name || state.user.login || '';
    document.getElementById('auth-name').textContent = state.user.name || state.user.login || 'Unknown';
    document.getElementById('auth-provider-badge').textContent = state.provider;
  } else {
    loggedOutEl.hidden = false;
    loggedInEl.hidden = true;
  }
}

function setButtonLoading(btn, isLoading, loadingText) {
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
    btn.classList.add('auth-btn-loading');
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.classList.remove('auth-btn-loading');
  }
}

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
  // Theme initialization
  await initTheme();

  // Auth initialization
  await authInit();
  updateAuthUI();

  const config = await loadConfig();
  renderRules(config.rules);

  document.getElementById('add-rule').addEventListener('click', () => {
    const container = document.getElementById('rules-container');
    const rule = {
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      days: [1, 2, 3, 4, 5],
      extensions: { enable: [], disable: [] },
      startupTabs: []
    };
    container.appendChild(createRuleCard(rule, container.children.length));
  });

  document.getElementById('save').addEventListener('click', async () => {
    const rules = collectRules();

    if (rules.length === 0) {
      showStatus('Add at least one rule before saving.', true);
      return;
    }

    for (const rule of rules) {
      if (!rule.startTime || !rule.endTime) {
        showStatus('Rule "' + rule.name + '" has a missing time value.', true);
        return;
      }
      if (rule.days.length === 0) {
        showStatus('Rule "' + rule.name + '" has no days selected.', true);
        return;
      }
    }

    await saveConfig({ rules });
    showStatus('Saved. Rules are now active.', false);
  });

  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm('Reset all rules to the defaults? This cannot be undone.')) return;
    await saveConfig(DEFAULT_CONFIG);
    renderRules(DEFAULT_CONFIG.rules);
    showStatus('Reset to default rules.', false);
  });

  document.getElementById('export-btn').addEventListener('click', exportConfig);

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importConfig(e.target.files[0]);
      e.target.value = '';
    }
  });

  // --- Theme toggle ---

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // --- Auth event listeners ---

  document.getElementById('login-github').addEventListener('click', async () => {
    try {
      setButtonLoading(document.getElementById('login-github'), true, 'Connecting...');
      await authLoginWithGithub();
      updateAuthUI();
      showStatus('Logged in with GitHub.', false);
    } catch (e) {
      showStatus('Login failed: ' + e.message, true);
    } finally {
      setButtonLoading(document.getElementById('login-github'), false, '');
    }
  });

  document.getElementById('login-google').addEventListener('click', async () => {
    try {
      setButtonLoading(document.getElementById('login-google'), true, 'Connecting...');
      await authLoginWithGoogle();
      updateAuthUI();
      showStatus('Logged in with Google.', false);
    } catch (e) {
      showStatus('Login failed: ' + e.message, true);
    } finally {
      setButtonLoading(document.getElementById('login-google'), false, '');
    }
  });

  document.getElementById('backup-btn').addEventListener('click', async () => {
    try {
      setButtonLoading(document.getElementById('backup-btn'), true, 'Backing up...');
      const config = await loadConfig();
      const result = await syncBackupConfig(config);
      showStatus(result.message, !result.success);
    } catch (e) {
      showStatus('Backup failed: ' + e.message, true);
    } finally {
      setButtonLoading(document.getElementById('backup-btn'), false, 'Backup Now');
    }
  });

  document.getElementById('restore-btn').addEventListener('click', async () => {
    if (!confirm('Restore settings from the cloud? This will replace your current rules.')) return;
    try {
      setButtonLoading(document.getElementById('restore-btn'), true, 'Restoring...');
      const result = await syncRestoreConfig();
      if (result.success && result.config) {
        await saveConfig(result.config);
        renderRules(result.config.rules);
      }
      showStatus(result.message, !result.success);
    } catch (e) {
      showStatus('Restore failed: ' + e.message, true);
    } finally {
      setButtonLoading(document.getElementById('restore-btn'), false, 'Restore');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (!confirm('Sign out? You will need to log in again to back up or restore.')) return;
    await authLogout();
    updateAuthUI();
    showStatus('Logged out.', false);
  });
});
