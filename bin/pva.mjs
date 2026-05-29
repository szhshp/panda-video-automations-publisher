#!/usr/bin/env node

import { spawnSync, execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { readFileSync } from "fs";
import chalk from "chalk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const require = createRequire(import.meta.url);
const PLAYWRIGHT_CLI = require.resolve("@playwright/test/cli");

const { version: CURRENT_VERSION } = JSON.parse(
  readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"),
);

const PKG_NAME = "@panda-video-automation/pva";

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
    return `dist/automations/${info.dir}/${action}-weixin-video.spec.js`;
  }
  if (action === "upload") {
    return `dist/automations/${info.dir}/upload-video.spec.js`;
  }
  return `dist/automations/${info.dir}/${action}-${platform}.spec.js`;
}

/**
 * Detect whether pva is installed globally.
 */
function isGlobalInstall() {
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    return __dirname.startsWith(globalRoot);
  } catch {
    return false;
  }
}

/**
 * Show current version (and optionally check npm for the latest).
 */
function showVersion(checkLatest) {
  console.log(`${chalk.bold("pva")} ${chalk.yellow(`v${CURRENT_VERSION}`)}`);

  if (checkLatest) {
    try {
      const latest = execSync(`npm view ${PKG_NAME} version`, {
        encoding: "utf-8",
        timeout: 10_000,
      }).trim();
      console.log(`${chalk.bold("Latest:")}   ${chalk.yellow(`v${latest}`)}`);

      if (CURRENT_VERSION !== latest) {
        console.log(
          `\n${chalk.yellow("A new version is available!")} Run ${chalk.cyan('"pva upgrade"')} to update.`,
        );
      } else {
        console.log(`\n${chalk.green("You're up to date!")}`);
      }
    } catch (err) {
      console.error(`\n${chalk.red("Failed to check latest version:")} ${err.message}`);
      process.exit(1);
    }
  }
}

/**
 * Upgrade pva to the latest version via npm.
 */
function upgrade() {
  const isGlobal = isGlobalInstall();
  const spec = `${PKG_NAME}@latest`;

  if (isGlobal) {
    console.log(`${chalk.cyan.bold("[pva]")} Detected global install — running: ${chalk.cyan("npm install -g " + spec)}`);
  } else {
    console.log(`${chalk.cyan.bold("[pva]")} Detected local install — running: ${chalk.cyan("npm install " + spec)}`);
  }

  const npmArgs = isGlobal
    ? ["install", "-g", spec]
    : ["install", spec];

  const result = spawnSync("npm", npmArgs, {
    stdio: "inherit",
    cwd: isGlobal ? undefined : PROJECT_ROOT,
  });

  if (result.status === 0) {
    // Read the updated version
    try {
      const newVersion = execSync(`npm ls ${PKG_NAME} --json`, {
        encoding: "utf-8",
        timeout: 5_000,
      });
      const parsed = JSON.parse(newVersion);
      const updatedVersion =
        parsed.version ||
        parsed?.dependencies?.[PKG_NAME]?.version ||
        CURRENT_VERSION;
      console.log(`\n${chalk.green("✅ pva has been updated to")} ${chalk.yellow(`v${updatedVersion}`)}${chalk.green("!")}`);
    } catch {
      console.log(`\n${chalk.green("✅ pva has been updated to the latest version!")}`);
    }
  } else {
    console.error(`\n${chalk.red("❌ Upgrade failed.")}`);
    process.exit(result.status ?? 1);
  }
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

  const cmd = args[0].toLowerCase();

  // Top-level commands
  if (cmd === "upgrade") {
    return { command: "upgrade" };
  }

  if (cmd === "version") {
    const checkLatest = args.includes("--check") || args.includes("-c");
    return { command: "version", checkLatest };
  }

  // Legacy: <platform> <action> [options]
  if (args.length < 2) {
    console.error(
      `${chalk.red("Error:")} Missing arguments. Usage: pva ${chalk.cyan("<platform>")} ${chalk.cyan("<action>")}`,
    );
    process.exit(1);
  }

  let rawPlatform = cmd;
  const action = args[1].toLowerCase();
  const extra = args.slice(2);

  // Resolve alias
  rawPlatform = ALIASES[rawPlatform] || rawPlatform;

  // Validate platform
  if (!PLATFORMS[rawPlatform]) {
    console.error(`${chalk.red("Error:")} Unknown platform "${rawPlatform}".`);
    console.error(`Valid platforms: ${Object.keys(PLATFORMS).map((p) => chalk.cyan(p)).join(", ")}`);
    process.exit(1);
  }

  // Validate action
  if (!ACTIONS.includes(action)) {
    console.error(
      `${chalk.red("Error:")} Unknown action "${action}". Use ${chalk.cyan('"login"')} or ${chalk.cyan('"upload"')}.`,
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
          console.error(`${chalk.red("Error:")} Unknown option "${extra[i]}".`);
          process.exit(1);
      }
    }
  }

  return { platform: rawPlatform, action, env };
}

function printHelp() {
  console.log(`
${chalk.bold("Usage:")} pva ${chalk.cyan("<command>")} [options]

${chalk.bold("Commands:")}
  ${chalk.cyan("upgrade")}               Upgrade pva to the latest version
  ${chalk.cyan("version")}               Show current version
  ${chalk.cyan("version --check")} (-c)  Check latest version on npm

  ${chalk.cyan("<platform>")} ${chalk.cyan("<action>")}   Run automation (e.g., bilibili login)

${chalk.bold("Platforms:")} ${chalk.cyan("bilibili")}, ${chalk.cyan("douyin")}, ${chalk.cyan("kuaishou")}, ${chalk.cyan("weixin")}, ${chalk.cyan("youtube")}
${chalk.bold("Actions:")}   login, upload

${chalk.bold("Aliases:")}
  weixinvideo, wechat ${chalk.dim("->")} weixin
  yt ${chalk.dim("->")} youtube

${chalk.bold("Upload options:")}
  ${chalk.cyan("--video <path>")}    Path to video file (or VIDEO_PATH env)
  ${chalk.cyan("--title <text>")}    Video title (or VIDEO_TITLE env)
  ${chalk.cyan("--desc <text>")}     Video description (or VIDEO_DESC env)
  ${chalk.cyan("--tags <list>")}     Comma-separated tags (or VIDEO_TAGS env)
  ${chalk.cyan("--cover <path>")}    Cover image path (or VIDEO_COVER env)
  ${chalk.cyan("--privacy <mode>")}  YouTube: public|unlisted|private (default: unlisted)
  ${chalk.cyan("--headless")}        Run browser in headless mode (default: headed)

${chalk.bold("Examples:")}
  pva ${chalk.cyan("upgrade")}
  pva ${chalk.cyan("version --check")}
  pva ${chalk.cyan("bilibili login")}
  pva ${chalk.cyan('youtube upload --video ./video.mp4 --title "My Video"')}
`);
}

function main() {
  const parsed = parseArgs(process.argv);

  // Handle top-level commands
  if (parsed.command === "upgrade") {
    upgrade();
    return;
  }

  if (parsed.command === "version") {
    showVersion(parsed.checkLatest);
    return;
  }

  // Legacy automation flow
  const { platform, action, env } = parsed;
  const info = PLATFORMS[platform];
  const spec = specFile(platform, action);
  const headed = env.PVA_HEADLESS ? "" : "--headed";

  console.log(`${chalk.cyan.bold("[pva]")} Platform: ${chalk.bold(info.dir)}`);
  console.log(`${chalk.cyan.bold("[pva]")} Action:   ${chalk.bold(action)}`);
  console.log(`${chalk.cyan.bold("[pva]")} Spec:     ${spec}`);

  const args = [
    PLAYWRIGHT_CLI,
    "test",
    spec,
    "--project=chromium",
    headed,
  ].filter(Boolean);

  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env,
  });

  process.exit(result.status ?? 1);
}

main();
