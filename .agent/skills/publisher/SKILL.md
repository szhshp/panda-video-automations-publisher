---
name: pva-publisher
description: Cross-platform video upload — Bilibili, Douyin, Kuaishou, Weixin Video, YouTube
---

# Publisher — Cross-platform Video Upload

Upload local video files to multiple video platforms using the `pva` CLI.

## When to Use

- After video rendering is complete, automatically distribute to content platforms
- As the final step in an oral video pipeline, publishing成品 to Bilibili, Douyin, Kuaishou, Weixin Video, and YouTube

## Prerequisites

- Node.js >= 20.9.0
- `@panda-video-automation/pva` installed globally or available in the project

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VIDEO_PATH` | Yes | Path to the video file |
| `VIDEO_TITLE` | Yes | Video title |
| `VIDEO_DESC` | No | Video description |
| `VIDEO_TAGS` | No | Comma-separated tags |
| `VIDEO_COVER` | No | Path to cover image |
| `VIDEO_PRIVACY` | No | YouTube only: `public` / `unlisted` / `private` |
| `PVA_HEADLESS` | No | Set to `1` for headless mode |

## Usage

### 1. Login (once per platform)

```bash
pva <platform> login
```

Supported platform identifiers:

| Platform | Identifier |
|----------|-----------|
| Bilibili | `bilibili` |
| Douyin | `douyin` |
| Kuaishou | `kuaishou` |
| Weixin Video | `weixin` |
| YouTube | `youtube` |

After login, the session is saved to `playwright/.auth/` for reuse.

### 2. Upload Video

Via CLI arguments:

```bash
pva <platform> upload \
  --video ./video.mp4 \
  --title "Video Title" \
  --desc "Description text" \
  --tags tag1,tag2
```

Or via environment variables (useful when integrating with a rendering pipeline):

```bash
export VIDEO_PATH=./output/final.mp4
export VIDEO_TITLE="Today's Topic"
export VIDEO_DESC="..."
pva bilibili upload
```

### 3. Batch Publishing

```bash
pva bilibili upload && pva douyin upload && pva kuaishou upload
```

## Workflow Integration Example

As the publish step in an oral video pipeline:

```
Render complete → MP4 output → set VIDEO_PATH/VIDEO_TITLE → pva platform upload
```

## Notes

- Each platform requires `login` once before first use
- Weixin Video sessions expire quickly and may need daily re-login
- Douyin requires manually checking the "content reflects personal opinion" declaration before publishing
- `--headless` mode may fail on some platforms due to CAPTCHA or popups; headed mode is the default

## References

- [CLI Usage Guide](../../docs/cli-usage-guide.md)
- [README](../../README.md)
