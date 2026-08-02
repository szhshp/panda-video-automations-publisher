---
name: setup-debug-env
description: Set up the local Playwright debug environment so tests run against source TypeScript in automations/ instead of the compiled dist/ output, with the right upload env vars configured for the VS Code Playwright extension. Use whenever the user wants to debug Playwright tests in VS Code, switch testDir away from dist, configure VIDEO_PATH / VIDEO_TITLE / VIDEO_COVER, fix a "No tests found" error, or asks to set up the local debug environment.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# Setup Local Playwright Debug Environment

Configure this repo so Playwright specs run against **source TypeScript** (`automations/`) with upload env vars available, both in the VS Code Playwright extension and via CLI.

Why: the committed `playwright.config.mjs` points `testDir` at `./dist/automations` — that is correct for the published `pva` CLI (it executes compiled output). Debugging, however, must use source. The working tree currently carries a local override; this schema reproduces that state deterministically and keeps it from leaking into commits.

## Reference state

The debug environment consists of these files (mirror the current unstaged setup):

| File | Purpose |
|---|---|
| `playwright.config.mjs` | Committed base config. Working tree must have `testDir: "./automations"` — this is what the VS Code extension reads. The override line is local-only; never commit it. |
| `playwright.config.local.mjs` | Gitignored local override (imports base config, sets `testDir: "./automations"`) for explicit CLI runs. |
| `.vscode/settings.json` | `playwright.env` object — env vars the VS Code Playwright extension injects. The extension does **not** auto-load `.env`, so this block is the reliable channel. |

## Steps

### 1. Inspect current state
Read: `playwright.config.mjs`, `playwright.config.local.mjs` (if present), `.gitignore`, `.vscode/settings.json`, `.env` (if present), `.claude/settings.json`. Note what already exists and what is missing.

### 2. Point Playwright at source (not dist)

**a. Base config (for the VS Code extension).** Ensure `playwright.config.mjs` has `testDir: "./automations"` in the working tree. The committed value is `"./dist/automations"`. If the line reads dist, change it to `./automations` and add a `/* DO NOT COMMIT THIS LINE */` marker so it is visibly local-only. Do not stage or commit this change.

**b. Local override (for CLI).** If `playwright.config.local.mjs` is missing, create it:

```mjs
// Local Playwright config — overrides testDir to use source TypeScript directly
// during development. Do not commit; published builds use ./dist/automations.
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.mjs';

export default defineConfig({
  ...baseConfig,
  testDir: './automations',
});
```

If it exists, confirm `testDir` is `'./automations'`.

**c. Gitignore.** Add `playwright.config.local.mjs` to `.gitignore` if not already listed. This file must never be committed.

### 3. Configure env vars (placeholders by default)
Resolve env values in this order:
1. `.env` at project root — parse `KEY=VALUE` lines.
2. Existing `playwright.env` block in `.vscode/settings.json`.
3. Placeholders — ask the user for real values if they are about to upload; otherwise write placeholders and tell them where to fill them in.

Merge a `playwright.env` object into `.vscode/settings.json` (do not clobber unrelated settings):

```json
{
  "playwright.env": {
    "VIDEO_PATH": "<path-to-video.mp4>",
    "VIDEO_TITLE": "<video-title>",
    "VIDEO_COVER": "<path-to-cover.png>"
  }
}
```

Keep placeholder values (`<...>`) if the user is not ready to upload, and point them to where to edit. The spec reads `VIDEO_PATH`, `VIDEO_TITLE` (required) and `VIDEO_DESC`, `VIDEO_TAGS`, `VIDEO_COVER` (optional) from `process.env`.

### 4. Verify
- Run `npx playwright test --config=playwright.config.local.mjs --list` — must list the `automations/` specs, not fail with `No tests found.`
- Confirm `.vscode/settings.json` is valid JSON and `playwright.env` has the expected keys.

## Report
Summarize: files changed, the resolved `testDir`, which env vars are set (concrete vs placeholder), and how to run — either the VS Code Playwright panel (green triangle on a spec) or:

```bash
npx playwright test --config=playwright.config.local.mjs --project=chromium --headed
```
