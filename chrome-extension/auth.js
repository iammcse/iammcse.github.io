// KSC hub - OAuth Authentication Module
// Handles GitHub and Google OAuth via chrome.identity.launchWebAuthFlow with PKCE.

// --- Replace these with your OAuth app credentials ---
const GITHUB_CLIENT_ID = 'Ov23lib1CTXAKn33CsIy';
const GITHUB_CLIENT_SECRET = '8fd47c5cdf57bb941b2786d618a450603cdc0eb3';
const GOOGLE_CLIENT_ID = '219732562129-759j9be0peg6r789qh17llgafug7v7i5.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
// ------------------------------------------------------

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let _authCache = { isLoggedIn: false, provider: null, user: null };

// --- PKCE Helpers ---

function _base64url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return _base64url(bytes);
}

async function _generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return _base64url(new Uint8Array(hash));
}

function _generateState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return _base64url(bytes);
}

function _redirectUri() {
  return 'https://' + chrome.runtime.id + '.chromiumapp.org/oauth_cb';
}

// --- Token Exchange ---

async function _exchangeGithubToken(code, codeVerifier) {
  const body = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code: code,
    redirect_uri: _redirectUri(),
    code_verifier: codeVerifier,
    grant_type: 'authorization_code'
  }).toString();

  console.log('[auth] GitHub token exchange — redirect_uri:', _redirectUri());
  console.log('[auth] GitHub token exchange — code length:', code.length);
  console.log('[auth] GitHub token exchange — client_id:', GITHUB_CLIENT_ID);

  const resp = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });

  const json = await resp.json();
  if (!resp.ok || json.error) {
    throw new Error(json.error_description || json.error || 'HTTP ' + resp.status);
  }
  return json.access_token;
}

async function _exchangeGoogleToken(code, codeVerifier) {
  const redirectUri = _redirectUri();
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code'
  }).toString();

  console.log('[auth] Google token exchange — redirect_uri:', redirectUri);
  console.log('[auth] Google token exchange — code length:', code.length);
  console.log('[auth] Google token exchange — code_verifier length:', codeVerifier.length);
  console.log('[auth] Google token exchange — client_id:', GOOGLE_CLIENT_ID);

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });

  const json = await resp.json();
  if (!resp.ok || json.error) {
    console.error('[auth] Google token error response:', JSON.stringify(json));
    throw new Error(json.error_description || json.error || 'HTTP ' + resp.status);
  }
  return json;
}

// --- User Info ---

async function _fetchGithubUser(token) {
  const resp = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
  });
  if (!resp.ok) throw new Error('Failed to fetch GitHub user: HTTP ' + resp.status);
  const json = await resp.json();
  return { login: json.login, avatar_url: json.avatar_url };
}

async function _fetchGoogleUser(token) {
  const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Failed to fetch Google user: HTTP ' + resp.status);
  const json = await resp.json();
  return { name: json.name, picture: json.picture };
}

// --- Token Refresh (Google only) ---

async function _refreshGoogleToken(refreshToken) {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  });
  const json = await resp.json();
  if (!resp.ok || json.error) {
    throw new Error(json.error_description || json.error || 'HTTP ' + resp.status);
  }
  return {
    access_token: json.access_token,
    expires_at: Date.now() + (json.expires_in * 1000) - 60000
  };
}

// --- Storage ---

async function _loadAuth() {
  const stored = await chrome.storage.local.get('auth');
  return stored.auth || null;
}

async function _storeAuth(auth) {
  await chrome.storage.local.set({ auth });
}

// --- Public API ---

async function authInit() {
  const auth = await _loadAuth();
  if (!auth) {
    _authCache = { isLoggedIn: false, provider: null, user: null };
    return _authCache;
  }

  if (auth.provider === 'google') {
    const now = Date.now();
    if (auth.google.expires_at <= now) {
      try {
        const refreshed = await _refreshGoogleToken(auth.google.refresh_token);
        auth.google.access_token = refreshed.access_token;
        auth.google.expires_at = refreshed.expires_at;
        await _storeAuth(auth);
      } catch (e) {
        await chrome.storage.local.remove('auth');
        _authCache = { isLoggedIn: false, provider: null, user: null };
        return _authCache;
      }
    }
  }

  _authCache = {
    isLoggedIn: true,
    provider: auth.provider,
    user: auth[auth.provider].user
  };
  return _authCache;
}

function authGetState() {
  return _authCache;
}

async function authLoginWithGithub() {
  const codeVerifier = _generateCodeVerifier();
  const codeChallenge = await _generateCodeChallenge(codeVerifier);
  const state = _generateState();

  const authUrl = GITHUB_AUTH_URL + '?' + new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: _redirectUri(),
    scope: 'gist',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  const resultUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });

  console.log('[auth] GitHub resultUrl:', resultUrl);

  const params = new URLSearchParams(new URL(resultUrl).search);
  const errorParam = params.get('error');
  if (errorParam) {
    throw new Error(params.get('error_description') || errorParam);
  }
  if (params.get('state') !== state) {
    throw new Error('State mismatch. Login aborted for security.');
  }

  const code = params.get('code');
  if (!code) throw new Error('No authorization code received.');

  console.log('[auth] GitHub authorization code obtained, length:', code.length);

  const token = await _exchangeGithubToken(code, codeVerifier);
  const user = await _fetchGithubUser(token);

  const auth = {
    provider: 'github',
    github: { token, user }
  };
  await _storeAuth(auth);

  _authCache = { isLoggedIn: true, provider: 'github', user };
  return _authCache;
}

async function authLoginWithGoogle() {
  const codeVerifier = _generateCodeVerifier();
  const codeChallenge = await _generateCodeChallenge(codeVerifier);
  const state = _generateState();

  const redirectUri = _redirectUri();
  const authUrl = GOOGLE_AUTH_URL + '?' + new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent'
  });

  console.log('[auth] Google auth URL:', authUrl);

  const resultUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });

  console.log('[auth] Google resultUrl:', resultUrl);

  const resultParsed = new URL(resultUrl);
  const params = new URLSearchParams(resultParsed.search);
  console.log('[auth] Google redirect search:', resultParsed.search);

  const errorParam = params.get('error');
  if (errorParam) {
    throw new Error(params.get('error_description') || errorParam);
  }
  if (params.get('state') !== state) {
    throw new Error('State mismatch. Login aborted for security.');
  }

  const code = params.get('code');
  if (!code) throw new Error('No authorization code received.');

  console.log('[auth] Google authorization code obtained, length:', code.length);

  const tokenData = await _exchangeGoogleToken(code, codeVerifier);
  if (!tokenData.refresh_token) {
    throw new Error('No refresh token received. Try logging in again.');
  }

  const user = await _fetchGoogleUser(tokenData.access_token);

  const auth = {
    provider: 'google',
    google: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000) - 60000,
      user
    }
  };
  await _storeAuth(auth);

  _authCache = { isLoggedIn: true, provider: 'google', user };
  return _authCache;
}

async function authGetToken() {
  const auth = await _loadAuth();
  if (!auth) throw new Error('Not logged in.');

  if (auth.provider === 'github') {
    return auth.github.token;
  }

  if (auth.provider === 'google') {
    if (auth.google.expires_at <= Date.now()) {
      try {
        const refreshed = await _refreshGoogleToken(auth.google.refresh_token);
        auth.google.access_token = refreshed.access_token;
        auth.google.expires_at = refreshed.expires_at;
        await _storeAuth(auth);
      } catch (e) {
        await chrome.storage.local.remove('auth');
        _authCache = { isLoggedIn: false, provider: null, user: null };
        throw new Error('Session expired. Please log in again.');
      }
    }
    return auth.google.access_token;
  }

  throw new Error('Unknown provider.');
}

async function authLogout() {
  await chrome.storage.local.remove('auth');
  _authCache = { isLoggedIn: false, provider: null, user: null };
}
