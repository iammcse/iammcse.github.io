// Time-Based Chrome Controller - Background Service Worker

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

// --- Config ---

async function getConfig() {
  const stored = await chrome.storage.local.get('config');
  return stored.config || DEFAULT_CONFIG;
}

// --- Time helpers ---

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

// --- Find next rule transition for alarm scheduling ---

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

// --- Apply extension enable/disable ---

async function applyExtensions(rule) {
  if (!rule || !rule.extensions) return;
  const { enable = [], disable = [] } = rule.extensions;
  const selfId = chrome.runtime.id;

  for (const id of enable) {
    const trimmed = id.trim();
    if (!trimmed || trimmed === selfId) continue;
    try {
      const ext = await chrome.management.get(trimmed);
      if (!ext.enabled) {
        await chrome.management.setEnabled(trimmed, true);
        console.log('Enabled:', trimmed);
      }
    } catch (e) {
      console.warn('Cannot enable', trimmed, ':', e.message);
    }
  }

  for (const id of disable) {
    const trimmed = id.trim();
    if (!trimmed || trimmed === selfId) continue;
    try {
      const ext = await chrome.management.get(trimmed);
      if (ext.enabled) {
        await chrome.management.setEnabled(trimmed, false);
        console.log('Disabled:', trimmed);
      }
    } catch (e) {
      console.warn('Cannot disable', trimmed, ':', e.message);
    }
  }
}

// --- Startup tabs ---

async function openStartupTabs(rule) {
  if (!rule || !rule.startupTabs) return;
  for (const url of rule.startupTabs) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    try {
      await chrome.tabs.create({ url: trimmed, active: false });
    } catch (e) {
      console.warn('Cannot open tab', trimmed, ':', e.message);
    }
  }
}

// --- Alarm scheduling ---

async function scheduleNextAlarm(rules) {
  await chrome.alarms.clear('timerule');
  const next = findNextTransition(rules);
  if (next) {
    await chrome.alarms.create('timerule', { when: next.getTime() });
    console.log('Next transition:', next.toLocaleString());
  }
}

// --- Main apply function ---

async function applyCurrentRules() {
  const config = await getConfig();
  const now = new Date();
  const rule = getActiveRule(config.rules, now);

  await applyExtensions(rule);
  await scheduleNextAlarm(config.rules);

  await chrome.storage.local.set({
    state: {
      lastCheck: now.toISOString(),
      activeRule: rule ? rule.name : null,
      nextTransition: findNextTransition(config.rules, now)?.toISOString() || null
    }
  });
}

// --- Event listeners ---

chrome.runtime.onStartup.addListener(async () => {
  const config = await getConfig();
  const now = new Date();
  const rule = getActiveRule(config.rules, now);
  await applyExtensions(rule);
  await openStartupTabs(rule);
  await scheduleNextAlarm(config.rules);
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('config');
  if (!stored.config) {
    await chrome.storage.local.set({ config: DEFAULT_CONFIG });
  }
  await applyCurrentRules();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timerule') {
    await applyCurrentRules();
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    console.log('Config changed, re-applying rules');
    await applyCurrentRules();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'applyNow') {
    applyCurrentRules().then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async response
  }
});
