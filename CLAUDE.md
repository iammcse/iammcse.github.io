# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KSC Hub is a Chrome Manifest V3 extension that automatically enables/disables other extensions and opens startup tabs based on time-of-day + day-of-week rules. It also supports cloud backup/restore of settings via GitHub Gist or Google Drive (OAuth login required).

## Development

There is no build step, bundler, or package manager. All files are vanilla JS loaded directly by Chrome.

- **Load the extension**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select the `chrome-extension/` directory.
- **Reload after changes**: Click the reload icon on the extension card, then refresh any open extension pages (options, popup).
- **Debug the service worker**: On `chrome://extensions`, click "Service Worker" next to the extension to open the background devtools.
- **Debug the options page**: Right-click the options page → Inspect.
- **Debug the popup**: Right-click the extension toolbar icon → Inspect popup. (The popup closes on blur; keep the devtools window focused.)

## Architecture

### Rules engine (`background.js`)

The service worker continuously evaluates which rule is active. Each rule has a name, time range (`startTime`/`endTime` in `HH:MM`), an array of days (0=Sun–6=Sat), plus actions: extension IDs to enable/disable and startup tab URLs.

- **Rule matching**: `getActiveRule()` iterates rules in config order and returns the **first match** (time range + day match). There is no priority system — order in the array is priority.
- **Time ranges** can cross midnight (e.g., 22:00–06:00). `isTimeInRange()` handles this via `(s <= e)` check.
- **Transitions** are scheduled via `chrome.alarms` — `findNextTransition()` scans the next 7 days for the earliest rule start/end boundary and sets a one-shot alarm.
- **Startup tabs**: `handleStartup()` fires on `chrome.runtime.onStartup` AND as a fallback on `chrome.windows.onCreated` (because Chrome on Windows often stays resident in the system tray and never fires onStartup). A 2-hour gap heuristic in `chrome.storage.session` prevents re-opening tabs on every window creation.
- **Config changes**: `chrome.storage.onChanged` listener re-applies rules immediately, plus triggers a debounced auto-backup (30s) if the user is logged in.

### Config storage

- `chrome.storage.local` key `config` — the rules array (see `DEFAULT_CONFIG` in background.js for the shape).
- `chrome.storage.session` key `startupTabsOpenedAt` — transient dedup timestamp.
- Both `background.js` and `options.js` have their own copy of `DEFAULT_CONFIG`. Changes to the shape must be made in both places.
- The options page validates on save: at least one rule required, each rule must have start/end times and at least one day selected.

### Auth (`auth.js`)

OAuth 2.0 Authorization Code flow with PKCE via `chrome.identity.launchWebAuthFlow`. Two providers: GitHub and Google.

- **Client credentials**: Stored as plain constants at the top of `auth.js` — both `CLIENT_ID` and `CLIENT_SECRET` for each provider. GitHub OAuth Apps and Google "Web application" clients both require `client_secret` in the token exchange, even with PKCE.
- **Redirect URI**: `https://<extension-id>.chromiumapp.org/oauth_cb` — computed dynamically via `chrome.runtime.id`. Must be registered in both OAuth app consoles.
- **Token storage**: `chrome.storage.local` key `auth` — contains provider name, access/refresh tokens, user profile, and backup resource ID (gist ID or Drive file ID).
- **Google tokens** expire after 1 hour. `authGetToken()` auto-refreshes before returning. If refresh fails, the session is cleared.
- **GitHub tokens** never expire (until revoked).
- **`auth.js` and `sync.js` are loaded in both contexts**: as `<script>` tags in `options.html` and via `importScripts()` in the service worker. Both files must remain DOM-free — only `chrome.*` APIs, `fetch`, `crypto.subtle`, and `TextEncoder`.

### Cloud backup (`sync.js`)

- **GitHub**: Config serialized as JSON and stored in a secret Gist with description `"KSC-Hub-Backup"`. The gist ID is persisted in the auth object so subsequent backups PATCH the same gist.
- **Google Drive**: Config stored as `ksc-hub-config.json` using the `drive.file` scope (files visible in the user's Drive, but the app can only access its own files). File ID persisted in auth object for updates.
- **Restore** validates the downloaded JSON against the same schema checks used by file import in options.js.

### Theme system

Both `options.html` and `popup.html` share an identical Material 3 CSS token approach (variables defined independently in each file since they're separate pages). Dark/light/auto modes via `data-theme` attribute on `<html>`. Preference stored in `chrome.storage.local` key `theme`. Auto mode follows `prefers-color-scheme`.

### Popup (`popup.html` + `popup.js`)

Read-only status view (360px wide). Shows the current active rule, next transition time, and a list of all extension IDs referenced across all rules with their enabled/disabled status. The "Apply Now" button sends a message to the service worker to re-evaluate rules immediately.

## Key patterns

- **All JS is vanilla** — no frameworks, no modules, no imports. Everything shares the global scope.
- **IDs are sacred**: The options page JS references DOM elements by ID everywhere (`getElementById`). Moving elements between containers is safe as long as IDs are preserved.
- **`escapeHtml()`** is used for all user-controlled strings injected into innerHTML in both options.js and popup.js.
- **The extension ID** (`chrome.runtime.id`) is stable for a given unpacked extension installation but changes if you remove and re-add it. The OAuth redirect URIs must match the current ID.
