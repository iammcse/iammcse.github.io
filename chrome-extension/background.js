// KSC hub - Background Service Worker

importScripts('auth.js', 'sync.js');

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

async function waitForWindow(attempts) {
  for (let i = 0; i < attempts; i++) {
    const windows = await chrome.windows.getAll();
    if (windows.length > 0) return windows[0].id;
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

async function openStartupTabs(rule) {
  if (!rule || !rule.startupTabs || !rule.startupTabs.length) return;

  const urls = rule.startupTabs.map(s => s.trim()).filter(Boolean);
  if (!urls.length) return;

  // onStartup fires early — wait for Chrome to create its first window
  const windowId = await waitForWindow(8);

  const tabIds = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const tab = await chrome.tabs.create({
        url: urls[i],
        active: i === 0,
        windowId
      });
      tabIds.push(tab.id);
    } catch (e) {
      console.warn('Cannot open startup tab', urls[i], ':', e.message);
    }
  }

  // Remove blank / new-tab placeholders Chrome opens by default so the
  // user sees only the configured startup tabs
  if (tabIds.length > 0) {
    try {
      const firstTab = await chrome.tabs.get(tabIds[0]);
      const tabs = await chrome.tabs.query({ windowId: firstTab.windowId });
      for (const tab of tabs) {
        if (tabIds.includes(tab.id)) continue;
        if (!tab.url || tab.url === 'chrome://newtab/' || tab.url === 'about:newtab' || tab.url === 'about:blank') {
          chrome.tabs.remove(tab.id).catch(() => {});
        }
      }
    } catch (e) { /* non-critical */ }
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

// --- Auto-backup helpers ---

async function hashConfig(config) {
  const json = JSON.stringify(config);
  const data = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function autoBackupIfNeeded() {
  try {
    const authData = await chrome.storage.local.get('auth');
    if (!authData.auth || !authData.auth.provider) return;

    const { config, lastBackupHash } = await chrome.storage.local.get(['config', 'lastBackupHash']);
    if (!config || !config.rules || config.rules.length === 0) return;

    const currentHash = await hashConfig(config);
    if (currentHash === lastBackupHash) return;

    const result = await syncBackupConfig(config);
    if (result.success) {
      await chrome.storage.local.set({ lastBackupHash: currentHash });
      console.log('Auto-backup: ' + result.message);
    } else {
      console.warn('Auto-backup failed: ' + result.message);
    }
  } catch (e) {
    console.warn('Auto-backup error:', e.message);
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

// --- Startup handling ---
// onStartup only fires when the Chrome profile fully restarts.  On Windows
// Chrome often stays resident in the system tray even after all windows are
// closed, so onStartup won't fire.  chrome.windows.onCreated is the fallback:
// the first window created after a gap counts as a session start.

async function handleStartup() {
  // Dedup so we open startup tabs at most once per session.  If Chrome
  // never fully quit (background mode) we treat a gap of 2+ hours as a
  // fresh session so tabs still open each morning / after long breaks.
  const { openedAt } = await chrome.storage.session.get('startupTabsOpenedAt');
  if (openedAt) {
    const elapsed = Date.now() - openedAt;
    if (elapsed < 2 * 60 * 60 * 1000) return;
  }
  await chrome.storage.session.set({ startupTabsOpenedAt: Date.now() });

  const config = await getConfig();
  const now = new Date();
  const rule = getActiveRule(config.rules, now);
  await applyExtensions(rule);
  await openStartupTabs(rule);
  await scheduleNextAlarm(config.rules);

  const existingAlarm = await chrome.alarms.get('autobackup');
  if (!existingAlarm) {
    await chrome.alarms.create('autobackup', { periodInMinutes: 360 });
  }
}

// --- Event listeners ---

chrome.runtime.onStartup.addListener(async () => {
  // Profile restarted — discard any stale session flag
  await chrome.storage.session.remove('startupTabsOpenedAt');
  await handleStartup();
});

// Fallback: first window created when Chrome never fully quit (background mode)
chrome.windows.onCreated.addListener(async () => {
  await handleStartup();
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
  if (alarm.name === 'autobackup') {
    await autoBackupIfNeeded();
  }
});

let _backupDebounceTimer = null;

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    console.log('Config changed, re-applying rules');
    await applyCurrentRules();

    if (_backupDebounceTimer) clearTimeout(_backupDebounceTimer);
    _backupDebounceTimer = setTimeout(() => {
      autoBackupIfNeeded();
    }, 30000);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'applyNow') {
    applyCurrentRules().then(() => sendResponse({ ok: true }));
    return true;
  }
});
