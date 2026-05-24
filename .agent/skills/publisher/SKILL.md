---
name: pva-publisher
description: Cross-platform video upload — Bilibili, Douyin, Kuaishou, Weixin Video, YouTube
---

# PVA Publisher

Cross-platform video upload using the `pva` CLI tool.

## Supported Platforms

| Platform | Alias | Login | Upload |
|----------|-------|-------|--------|
| Bilibili | `bilibili` | `pva bilibili login` | `pva bilibili upload` |
| Douyin | `douyin` | `pva douyin login` | `pva douyin upload` |
| Kuaishou | `kuaishou` | `pva kuaishou login` | `pva kuaishou upload` |
| Weixin Video | `weixin` / `wechat` / `weixinvideo` | `pva weixin login` | `pva weixin upload` |
| YouTube | `youtube` / `yt` | `pva youtube login` | `pva youtube upload` |

## Upload Options

- `--video <path>` — Path to video file (or `VIDEO_PATH` env)
- `--title <text>` — Video title (or `VIDEO_TITLE` env)
- `--desc <text>` — Video description (or `VIDEO_DESC` env)
- `--tags <list>` — Comma-separated tags (or `VIDEO_TAGS` env)
- `--cover <path>` — Cover image path (or `VIDEO_COVER` env)
- `--privacy <mode>` — YouTube only: `public|unlisted|private` (default: `unlisted`)
- `--headless` — Run browser in headless mode (default: **headed**)

## Running Multiple Platforms in Parallel

Login and upload tasks can run multiple platforms concurrently using shell backgrounding:

### Parallel Login

```bash
pva douyin login &
pva kuaishou login &
wait
```

### Parallel Upload

```bash
pva douyin upload --video ./video.mp4 --title "Title" &
pva kuaishou upload --video ./video.mp4 --title "Title" &
wait
```

### One headed, one headless (avoids window chaos)

```bash
pva douyin upload --video ./video.mp4 --title "Title" --headless &
pva kuaishou upload --video ./video.mp4 --title "Title" &
wait
```

### All headless

```bash
pva douyin upload --video ./video.mp4 --title "Title" --headless &
pva kuaishou upload --video ./video.mp4 --title "Title" --headless &
wait
```

## Important Notes

- **Default mode is headed** (visible browser). Only use `--headless` if explicitly requested.
- Each `pva` process launches its own Playwright browser instance — no conflict between platforms.
- Saved auth state is in `~/.local/share/mise/installs/node/22/lib/node_modules/@panda-video-automation/pva/playwright/.auth/`.
- Login only needs to be done once; subsequent uploads reuse saved sessions.
- `pva --help` for full CLI reference.
