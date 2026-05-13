// KSC hub - Cloud Backup/Restore Module
// Backs up config to GitHub Gist (GitHub login) or Google Drive (Google login).

const GIST_DESCRIPTION = 'KSC-Hub-Backup';
const GIST_FILENAME = 'ksc-hub-config.json';
const DRIVE_FILENAME = 'ksc-hub-config.json';

// --- Public API ---

async function syncBackupConfig(config) {
  try {
    const token = await authGetToken();
    const auth = await chrome.storage.local.get('auth');
    const provider = auth.auth && auth.auth.provider;

    if (provider === 'github') return await _githubBackup(config, token, auth.auth);
    if (provider === 'google') return await _googleBackup(config, token, auth.auth);
    return { success: false, message: 'Not logged in.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function syncRestoreConfig() {
  try {
    const token = await authGetToken();
    const auth = await chrome.storage.local.get('auth');
    const provider = auth.auth && auth.auth.provider;

    let result;
    if (provider === 'github') result = await _githubRestore(token, auth.auth);
    else if (provider === 'google') result = await _googleRestore(token, auth.auth);
    else return { success: false, message: 'Not logged in.' };

    if (result.success && result.config) {
      if (!result.config.rules || !Array.isArray(result.config.rules)) {
        return { success: false, message: 'Cloud data is corrupt or not a valid config.' };
      }
      for (const rule of result.config.rules) {
        if (!rule.name || !rule.startTime || !rule.endTime || !Array.isArray(rule.days)) {
          return { success: false, message: 'Cloud data contains malformed rules.' };
        }
      }
    }
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// --- GitHub Gist ---

async function _githubFindGist(token) {
  const resp = await fetch('https://api.github.com/gists?per_page=100', {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('GitHub token expired. Please log in again.');
    throw new Error('GitHub API error: HTTP ' + resp.status);
  }
  const gists = await resp.json();
  const matches = gists.filter(g => g.description && g.description.includes(GIST_DESCRIPTION));
  if (matches.length === 0) return null;
  matches.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return matches[0].id;
}

async function _githubBackup(config, token, authData) {
  const body = {
    description: GIST_DESCRIPTION,
    public: false,
    files: { [GIST_FILENAME]: { content: JSON.stringify(config, null, 2) } }
  };

  let gistId = authData.github.backupGistId;
  if (!gistId) {
    gistId = await _githubFindGist(token);
  }

  let resp;
  if (gistId) {
    resp = await fetch('https://api.github.com/gists/' + gistId, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (resp.status === 404) {
      gistId = null;
    }
  }

  if (!gistId) {
    resp = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  if (!resp.ok) {
    if (resp.status === 401) throw new Error('GitHub token expired. Please log in again.');
    throw new Error('GitHub Gist API error: HTTP ' + resp.status);
  }

  const json = await resp.json();
  authData.github.backupGistId = json.id;
  await chrome.storage.local.set({ auth: authData });

  return { success: true, message: 'Backed up to GitHub Gist.' };
}

async function _githubRestore(token, authData) {
  let gistId = authData.github.backupGistId;
  if (!gistId) {
    gistId = await _githubFindGist(token);
  }
  if (!gistId) {
    return { success: false, message: 'No backup found on GitHub.' };
  }

  const resp = await fetch('https://api.github.com/gists/' + gistId, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('GitHub token expired. Please log in again.');
    throw new Error('GitHub API error: HTTP ' + resp.status);
  }

  const json = await resp.json();
  const file = json.files && json.files[GIST_FILENAME];
  if (!file || !file.content) {
    return { success: false, message: 'Backup gist found but contains no config file.' };
  }

  let config;
  try {
    config = JSON.parse(file.content);
  } catch (e) {
    return { success: false, message: 'Cloud data is not valid JSON.' };
  }

  // Remember the gist ID for future operations
  if (!authData.github.backupGistId) {
    authData.github.backupGistId = json.id;
    await chrome.storage.local.set({ auth: authData });
  }

  return { success: true, message: 'Restored ' + (config.rules ? config.rules.length : 0) + ' rule(s) from GitHub Gist.', config };
}

// --- Google Drive ---

async function _googleFindFile(token) {
  const q = 'name=\'' + DRIVE_FILENAME + '\' and trashed=false';
  const resp = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('Google session expired. Please log in again.');
    throw new Error('Google Drive API error: HTTP ' + resp.status);
  }
  const json = await resp.json();
  return json.files && json.files.length > 0 ? json.files[0] : null;
}

async function _googleBackup(config, token, authData) {
  const content = JSON.stringify(config, null, 2);

  let fileId = authData.google.backupFileId;
  if (!fileId) {
    const existing = await _googleFindFile(token);
    if (existing) fileId = existing.id;
  }

  if (fileId) {
    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: content
    });
    if (!resp.ok) {
      if (resp.status === 404) fileId = null;
      else if (resp.status === 401) throw new Error('Google session expired. Please log in again.');
      else throw new Error('Google Drive API error: HTTP ' + resp.status);
    }
  }

  if (!fileId) {
    const boundary = 'ksc-' + Date.now();
    const metadata = JSON.stringify({ name: DRIVE_FILENAME });
    const multipart = '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      content + '\r\n' +
      '--' + boundary + '--';

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: multipart
    });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Google session expired. Please log in again.');
      throw new Error('Google Drive API error: HTTP ' + resp.status);
    }
    const json = await resp.json();
    fileId = json.id;
  }

  authData.google.backupFileId = fileId;
  await chrome.storage.local.set({ auth: authData });

  return { success: true, message: 'Backed up to Google Drive.' };
}

async function _googleRestore(token, authData) {
  let fileId = authData.google.backupFileId;
  if (!fileId) {
    const existing = await _googleFindFile(token);
    if (existing) fileId = existing.id;
  }
  if (!fileId) {
    return { success: false, message: 'No backup found on Google Drive.' };
  }

  const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('Google session expired. Please log in again.');
    throw new Error('Google Drive API error: HTTP ' + resp.status);
  }

  let config;
  try {
    config = await resp.json();
  } catch (e) {
    return { success: false, message: 'Cloud data is not valid JSON.' };
  }

  if (!authData.google.backupFileId) {
    authData.google.backupFileId = fileId;
    await chrome.storage.local.set({ auth: authData });
  }

  return { success: true, message: 'Restored ' + (config.rules ? config.rules.length : 0) + ' rule(s) from Google Drive.', config };
}
