# Panda Video Automation Publisher

这是一个基于 Playwright 的视频上传自动化 CLI 工具，支持以下平台：

- Bilibili
- Douyin
- Kuaishou
- Weixin Video
- YouTube

## 安装

```bash
pnpm install
```

安装完成后，会自动运行：

```bash
npx playwright install chromium
```

## 用法

```bash
pva <platform> <action> [options]
```

支持的平台：`bilibili`、`douyin`、`kuaishou`、`weixin`、`youtube`

支持的操作：`login`、`upload`

## 示例

```bash
pva bilibili login
pva youtube upload --video ./video.mp4 --title "My Video" --desc "Video description"
```

如果通过 `pnpm run` 执行：

```bash
pnpm run upload:youtube -- --video ./video.mp4 --title "My Video"
```

## 上传参数

- `--video <path>`：视频文件路径
- `--title <text>`：视频标题
- `--desc <text>`：视频描述
- `--tags <list>`：逗号分隔标签
- `--cover <path>`：封面图片路径
- `--privacy <mode>`：仅用于 YouTube，可选 `public|unlisted|private`
- `--headless`：无头模式运行浏览器

这些参数也可以使用环境变量替代：

- `VIDEO_PATH`
- `VIDEO_TITLE`
- `VIDEO_DESC`
- `VIDEO_TAGS`
- `VIDEO_COVER`
- `VIDEO_PRIVACY`
- `PVA_HEADLESS=1`

## 注意

`pva` 会调用 `npx playwright test <spec>` 来运行自动化脚本，具体实现位于 `automations/` 目录下。
