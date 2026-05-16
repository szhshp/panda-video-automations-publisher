#!/usr/bin/env node

import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// Platform mapping: CLI name -> directory name + auth key
const PLATFORMS = {
  bilibili: { dir: "Bilibili", authKey: "bilibili" },
  douyin: { dir: "Douyin", authKey: "douyin" },
  kuaishou: { dir: "Kuaishou", authKey: "kuaishou" },
  weixin: { dir: "WeixinVideo", authKey: "weixin" },
  youtube: { dir: "YouTube", authKey: "youtube" },
};

const ACTIONS = ["login", "upload"];

// Platform aliases
const ALIASES = {
  weixinvideo: "weixin",
  wechat: "weixin",
  yt: "youtube",
};

/**
 * Resolve the spec file path for a given platform and action.
 *
 * Naming convention in automations/:
 *   Login:  login-<platform>.spec.ts (weixin: login-weixin-video.spec.ts)
 *   Upload: upload-video.spec.ts    (weixin: upload-weixin-video.spec.ts)
 */
function specFile(platform, action) {
  const info = PLATFORMS[platform];
  if (platform === "weixin") {
    return `automations/${info.dir}/${action}-weixin-video.spec.ts`;
  }
  if (action === "upload") {
    return `automations/${info.dir}/upload-video.spec.ts`;
  }
  return `automations/${info.dir}/${action}-${platform}.spec.ts`;
}

/**
 * Parse CLI arguments.
 */
function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  if (args.length < 2) {
    console.error("Error: Missing arguments. Usage: pva <platform> <action>");
    process.exit(1);
  }

  let rawPlatform = args[0].toLowerCase();
  const action = args[1].toLowerCase();
  const extra = args.slice(2);

  // Resolve alias
  rawPlatform = ALIASES[rawPlatform] || rawPlatform;

  // Validate platform
  if (!PLATFORMS[rawPlatform]) {
    console.error(`Error: Unknown platform "${rawPlatform}".`);
    console.error(`Valid platforms: ${Object.keys(PLATFORMS).join(", ")}`);
    process.exit(1);
  }

  // Validate action
  if (!ACTIONS.includes(action)) {
    console.error(
      `Error: Unknown action "${action}". Use "login" or "upload".`,
    );
    process.exit(1);
  }

  // Parse upload options into env vars
  const env = { ...process.env };
  if (action === "upload") {
    for (let i = 0; i < extra.length; i++) {
      switch (extra[i]) {
        case "--video":
          env.VIDEO_PATH = extra[++i];
          break;
        case "--title":
          env.VIDEO_TITLE = extra[++i];
          break;
        case "--desc":
          env.VIDEO_DESC = extra[++i];
          break;
        case "--tags":
          env.VIDEO_TAGS = extra[++i];
          break;
        case "--cover":
          env.VIDEO_COVER = extra[++i];
          break;
        case "--privacy":
          env.VIDEO_PRIVACY = extra[++i];
          break;
        case "--headless":
          env.PVA_HEADLESS = "1";
          break;
        default:
          console.error(`Error: Unknown option "${extra[i]}".`);
          process.exit(1);
      }
    }
  }

  return { platform: rawPlatform, action, env };
}

function printHelp() {
  console.log(`
Usage: pva <platform> <action> [options]

Platforms: bilibili, douyin, kuaishou, weixin, youtube
Actions:   login, upload

Aliases:
  weixinvideo, wechat -> weixin
  yt -> youtube

Upload options:
  --video <path>    Path to video file (or VIDEO_PATH env)
  --title <text>    Video title (or VIDEO_TITLE env)
  --desc <text>     Video description (or VIDEO_DESC env)
  --tags <list>     Comma-separated tags (or VIDEO_TAGS env)
  --cover <path>    Cover image path (or VIDEO_COVER env)
  --privacy <mode>  YouTube: public|unlisted|private (default: unlisted)
  --headless        Run browser in headless mode (default: headed)

Examples:
  pva bilibili login
  pva youtube upload --video ./video.mp4 --title "My Video"
  pva douyin upload --title "Hello" --tags tag1,tag2
`);
}

function main() {
  const { platform, action, env } = parseArgs(process.argv);
  const info = PLATFORMS[platform];
  const spec = specFile(platform, action);
  const headed = env.PVA_HEADLESS ? "" : "--headed";

  console.log(`[pva] Platform: ${info.dir}`);
  console.log(`[pva] Action:   ${action}`);
  console.log(`[pva] Spec:     ${spec}`);

  const args = [
    "playwright",
    "test",
    spec,
    "--project=chromium",
    headed,
  ].filter(Boolean);

  const result = spawnSync("npx", args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env,
  });

  process.exit(result.status ?? 1);
}

main();
