// Time-Based Chrome Controller - Options Page Script

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

function showStatus(message, isError) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = isError ? 'status-error' : 'status-success';
  if (!isError) {
    setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
  }
}

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
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
});
