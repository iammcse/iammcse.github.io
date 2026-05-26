# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Pages site (`iammcse.github.io`) hosting companion web tools for the KSC Hub Chrome extension. All files are vanilla JS/HTML — no build step, bundler, or package manager.

## Key Files

- **`index.html`** — Placeholder GitHub Pages landing page
- **`openlink.html`** — Receives URL parameters (`serverParam`, `morningParam`, `afternoonParam`, `offset`) and opens bookmarked Chrome tabs
- **`openlink.js`** / **`openlink_NEW.js`** — Same link-opener logic in standalone JS files
- **`opentabs.html`** — Countdown timer page that triggers opening tabs at scheduled times
- **`opentabs_gen2.html`** — Updated version of the countdown timer
- **`Prototype_Opentabs 1.0.html`** / **`Prototype_Opentabs 1.1.html`** — Prototype iterations of the opentabs feature

## Related Repos

The KSC Hub Chrome extension itself lives in the sibling `chrome-extension/` directory. These pages are what the extension opens via URL parameters to schedule and manage browser tabs.
