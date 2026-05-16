import { test } from '@playwright/test';
import { performLogin, getAuthFilePath } from '../utils/login-helper';

/**
 * Login script for RedNote
 * Run this ONCE to login and save your session
 * After login, your session will be saved and reused in other tests
 *
 * Usage: pnpm login:rednote
 *
 * Note: This script has NO timeout limit - you can take as long as you need to login.
 * The script will pause and wait for you to complete the login process manually.
 */

const REDNOTE_STRICT_ENFORCEMENT_LINES = [
  '小红书存在极其严格的反自动化检测, 过度使用将会被官方限制账号功能',
  '其他平台根本没有这种多余的限制 😑😑',
  '谨慎使用.',
];

const ANSI_RESET = '\x1b[0m';
/** 43m = yellow bg. Avoid 2m (dim): some terminals draw faint text without the bg. */
const SGR = {
  yb: '\x1b[1;43;30m', // black on yellow
  yr: '\x1b[1;43;31m', // red on yellow
  /** Footer: bright black on yellow — no dim */
  yd: '\x1b[1;43;90m',
} as const;

function termWidth(): number {
  const c = process.stdout?.columns;
  return typeof c === 'number' && c > 0 ? c : 100;
}

/** Monospace width: printable ASCII 1, else 2 (CJK, emoji, ▓, ⛔, —). */
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    w += c >= 0x20 && c <= 0x7e ? 1 : 2;
  }
  return w;
}

/** Full-width yellow row: pad with spaces before reset so the line stays yellow. */
function yellowLine(sgr: string, body: string): string {
  const w = termWidth();
  const used = displayWidth(body);
  const pad = Math.max(0, w - used);
  return `${sgr}${body}${' '.repeat(pad)}${ANSI_RESET}`;
}

/** High-visibility terminal banner (full-width yellow rows, ANSI). */
function printRedNoteLoginAlert(): void {
  const out: string[] = [
    '',
    yellowLine(SGR.yb, ''),
    yellowLine(SGR.yb, '  ▓▓  小红书 (Xiaohongshu / RedNote) — 运行登录前请阅读  ▓▓  '),
    yellowLine(SGR.yb, ''),
  ];
  REDNOTE_STRICT_ENFORCEMENT_LINES.forEach((line, i) => {
    const lead = i === 0 ? '⛔  ' : '    ';
    out.push(yellowLine(SGR.yr, `  ${lead}${line}  `));
  });
  out.push(
    yellowLine(SGR.yb, ''),
    yellowLine(SGR.yd, '  (This message is shown every time the RedNote login spec runs.)  '),
    yellowLine(SGR.yb, ''),
    '',
  );
  // eslint-disable-next-line no-console -- intentional user-facing login warning
  console.log(out.join('\n'));
}

// Set timeout to 15 minutes for login tests to ensure enough time
test.describe('RedNote login (session capture)', () => {
  test.describe.configure({ timeout: 15 * 60 * 1000 }); // 15 minutes

  test.beforeEach(() => {
    printRedNoteLoginAlert();
  });

  test('login to rednote - run this once to save login state', async ({ page, context }) => {
    // Set timeout to 15 minutes for this specific test
    test.setTimeout(15 * 60 * 1000);

    // Also set page timeout to ensure all operations have enough time
    page.setDefaultTimeout(10 * 60 * 1000);

    await performLogin(page, context, {
      platform: 'RedNote',
      loginUrl: 'https://creator.xiaohongshu.com/',
      loginIndicators: [
        // Logged-in indicators for Xiaohongshu Creator Platform
        '[class*="avatar"]',
        '[class*="profile"]',
        '[class*="user-menu"]',
        '[class*="user-info"]',
        '[class*="account"]',
        'text=创作中心',
        'text=内容管理',
        'text=数据中心',
        '[class*="creator"]',
        '[class*="dashboard"]',
      ],
      notLoggedInIndicators: [
        // Indicators that show user is NOT logged in
        'text=登录',
        'text=Login',
        'button:has-text("登录")',
        'button:has-text("Login")',
        'a:has-text("登录")',
        'a:has-text("Login")',
        '[class*="login-btn"]',
        '[class*="login-button"]',
        'text=立即登录',
        'text=注册',
        'text=Sign Up',
        '[class*="login-form"]',
        '[class*="login-container"]',
      ],
      authFilePath: getAuthFilePath('rednote'),
    });
  });
});
