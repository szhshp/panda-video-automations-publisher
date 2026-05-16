import { test } from '@playwright/test';
import { performLogin, getAuthFilePath } from '../utils/login-helper';

/**
 * Login script for Bilibili
 * Run this ONCE to login and save your session
 * After login, your session will be saved and reused in other tests
 * 
 * Usage: pnpm login:bilibili
 * 
 * Note: This script has NO timeout limit - you can take as long as you need to login.
 * The script will pause and wait for you to complete the login process manually.
 */

// Set timeout to 15 minutes for login tests to ensure enough time
test.describe.configure({ timeout: 15 * 60 * 1000 }); // 15 minutes

test('login to bilibili - run this once to save login state', async ({ page, context }) => {
  // Set timeout to 15 minutes for this specific test
  test.setTimeout(15 * 60 * 1000);
  
  // Also set page timeout to ensure all operations have enough time
  page.setDefaultTimeout(10 * 60 * 1000);
  
  await performLogin(page, context, {
    platform: 'Bilibili',
    loginUrl: 'https://www.bilibili.com/',
    loginIndicators: [
      // More specific logged-in indicators
      '.header-avatar-wrap', // User avatar wrapper (only exists when logged in)
      'text=个人中心',
      '.header-user-info',
      // Check for user menu or dropdown
      '[class*="header-user-info"]:has([class*="avatar"])',
    ],
    notLoggedInIndicators: [
      // Indicators that show user is NOT logged in
      'text=登录',
      'button:has-text("登录")',
      'a:has-text("登录")',
      '[class*="login-btn"]',
      '[class*="login-button"]',
      'text=立即登录',
      'text=注册',
    ],
    authFilePath: getAuthFilePath('bilibili'),
  });
});
