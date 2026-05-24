<div align="center">
  <img src="https://raw.githubusercontent.com/szhshp/panda-video-automations-publisher/main/docs/assets/logo.png" width="200" alt="Panda Video Automation Publisher Logo">

  # Panda Video Automation Publisher

  **跨平台视频上传自动化引擎**

  *"One CLI to publish everywhere."*

  [![npm version](https://img.shields.io/npm/v/@panda-video-automation/pva)](https://www.npmjs.com/package/@panda-video-automation/pva)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
  [![Playwright](https://img.shields.io/badge/Playwright-latest-45ba4b)](https://playwright.dev/)

  > 🐼 [Panda Video Generator](https://github.com/szhshp/panda-video-generator) 的发布模块，独立为 npm 包，可单独使用或集成到自有流水线。

  <div style="margin: 18px 0 6px;">
    <a href="https://panda.szhshp.org/cli" title="PVA 官方网站" style="display: inline-block; padding: 12px 28px; border: 2px solid #0969da; border-radius: 8px; font-weight: 700; font-size: 1.1em; text-decoration: none; color: #fff; background: #0969da; margin: 0 8px;">🌐 官方网站</a>
    <a href="https://www.npmjs.com/package/@panda-video-automation/pva" title="npm 包" style="display: inline-block; padding: 12px 28px; border: 2px solid #cb3837; border-radius: 8px; font-weight: 700; font-size: 1.1em; text-decoration: none; color: #fff; background: #cb3837; margin: 0 8px;">📦 npm 安装</a>
  </div>

</div>

---

## ✨ 核心特性

<table cellspacing="16" cellpadding="0" border="0">
  <tr valign="top">
    <td width="34%" valign="top">
      <h3>🔐 <mark>一键</mark> 登录 & Session 管理</h3>
      <p>一次登录，长期复用。自动保存浏览器 Storage State，减少重复认证操作。</p>
    </td>
    <td width="33%" valign="top">
      <h3>📤 <mark>一键</mark> 多平台上传</h3>
      <p>视频、标题、描述、标签、封面—统一参数模型，不同平台自动适配。</p>
    </td>
    <td width="33%" valign="top">
      <h3>🔄 <mark>一键</mark> 批量发布</h3>
      <p>单条命令串行发布到多个平台，适合 CI/CD 与定时任务集成。</p>
    </td>
  </tr>
</table>

---

<a id="demo"></a>
## ❇️ 功能演示

> 《已开源！视频号多平台发布工具 CLI》

<a href="https://www.bilibili.com/video/BV15ZG766E4g">
  <img src="https://raw.githubusercontent.com/szhshp/panda-video-automations-publisher/main/docs/assets/video-cover-1.png" alt="功能演示 · 点击在 Bilibili 播放" width="480" />
</a>

---

## 🚀 快速开始

### 安装

```bash
npm install -g @panda-video-automation/pva
```

> **环境要求：** Node.js >= 20.9.0，安装后 `pva` 命令即可全局使用。

### 1. 登录（每个平台只需一次）

```bash
pva bilibili login
```

打开浏览器，手动完成登录后自动检测并持久化 Session。后续上传无需重复登录。

> Session 有效期因平台而异：大部分平台可保持较长时间，但微信视频号需要每日重新登录。

### 2. 上传视频

```bash
pva youtube upload --video ./demo.mp4 --title "我的视频"
```

---

## 📖 CLI 参考

```
pva <platform> <action> [options]
```

### 平台列表

| 平台 | 标识符 | 别名 |
|------|--------|------|
| Bilibili | `bilibili` | |
| 抖音 | `douyin` | |
| 快手 | `kuaishou` | |
| 微信视频号 | `weixin` | `weixinvideo`、`wechat` |
| YouTube | `youtube` | `yt` |

### 操作

| 操作 | 说明 |
|------|------|
| `login` | 登录并保存浏览器 Session |
| `upload` | 上传视频及元数据 |

### 上传参数

参数可通过 CLI 标志或环境变量传入。

| 参数 | 环境变量 | 说明 |
|------|---------|------|
| `--video <path>` | `VIDEO_PATH` | 视频文件路径 **（必填）** |
| `--title <text>` | `VIDEO_TITLE` | 视频标题 **（必填）** |
| `--desc <text>` | `VIDEO_DESC` | 视频描述 |
| `--tags <list>` | `VIDEO_TAGS` | 逗号分隔的标签 |
| `--cover <path>` | `VIDEO_COVER` | 封面图片路径 |
| `--privacy <mode>` | `VIDEO_PRIVACY` | YouTube：`public`、`unlisted`（默认）、`private` |
| `--headless` | `PVA_HEADLESS=1` | 无头模式运行（默认有头） |

### 示例

```bash
# 登录
pva douyin login

# CLI 参数上传
pva bilibili upload \
  --video ./video.mp4 \
  --title "My Title" \
  --desc "Description" \
  --tags tag1,tag2

# 环境变量上传
export VIDEO_PATH=./video.mp4
export VIDEO_TITLE="My Video"
pva youtube upload

# 无头模式
pva kuaishou upload --video ./demo.mp4 --title "Test" --headless

# 批量发布
pva bilibili upload && pva douyin upload && pva kuaishou upload
```

---

## 🧩 集成到 Panda Video Generator

本包是 [Panda Video Generator](https://github.com/szhshp/panda-video-generator) 发布模块的独立封装。在完整的视频生产流水线中，典型的工作流为：

```
网页抓取 → LLM 文稿优化 → Edge TTS + 字幕 → Remotion 渲染 → 本包发布
```

渲染完成后，直接调用 `pva` 将成片分发到各平台。

---

## 📋 平台限制

| 平台 | 标题长度 | 描述字段 | 注意事项 |
|------|---------|---------|---------|
| 抖音 | 30 字 | 支持 | 发布前需勾选"内容为个人观点或见解" |
| 快手 | 标题+描述合并 | 合并到标题 | 使用 `contenteditable` 单一字段 |
| Bilibili | 无严格限制 | 支持 | 支持 AI 生成内容标注 |
| 微信视频号 | 无严格限制 | 支持 | 使用"昨日数据"文本判断登录状态 |
| YouTube | 无严格限制 | 支持 | 支持隐私级别：`public` / `unlisted` / `private` |

---

## 🔧 本地开发

```bash
# 安装依赖
pnpm install

# 构建 TypeScript
pnpm build

# 登录快捷命令
pnpm login:bilibili    pnpm login:douyin    pnpm login:kuaishou
pnpm login:weixin      pnpm login:youtube

# 上传快捷命令
pnpm upload:bilibili   pnpm upload:douyin   pnpm upload:kuaishou
pnpm upload:weixin     pnpm upload:youtube

# 全平台发布
pnpm upload:all
```

---

## ⚙️ 实现原理

基于 [Playwright Test](https://playwright.dev/) 的浏览器自动化框架：

1. **登录流程** — 打开目标平台的创作者后台，等待用户手动登录，检测到成功状态后保存浏览器 Storage State 到 `playwright/.auth/`
2. **上传流程** — 恢复已保存的 Session，导航到上传页面，自动定位表单控件并填充视频元数据，提交发布
3. **Spec 文件** 位于 `automations/` 目录，按平台分目录组织
4. TypeScript 源码编译为 JS 后发布到 npm，产物在 `dist/` 目录

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 👤 作者

**szhshp**

- Email: 24031shp@sina.com
- GitHub: [@szhshp](https://github.com/szhshp)

---

## ⚠️ 免责声明

本项目按「原样」提供。你在使用浏览器自动化上传功能时，须**自行确保**符合适用法律法规、各平台服务条款及 robots 规则；请勿将本工具用于未经授权的抓取、侵权转载或垃圾信息传播。本仓库与第三方平台**无任何隶属或合作关系**。

---

<div align="center">
  Made with ❤️ by szhshp · 熊猫智研社
</div>
