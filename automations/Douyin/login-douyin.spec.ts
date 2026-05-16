import { test } from '@playwright/test';
import { performLogin, getAuthFilePath } from '../utils/login-helper';

/**
 * Login script for Douyin (抖音 - TikTok China)
 * Run this ONCE to login and save your session
 * After login, your session will be saved and reused in other tests
 * 
 * Usage: pnpm login:douyin
 * 
 * Note: This script has NO timeout limit - you can take as long as you need to login.
 * The script will pause and wait for you to complete the login process manually.
 */

// Set timeout to 15 minutes for login tests to ensure enough time
test.describe.configure({ timeout: 15 * 60 * 1000 }); // 15 minutes

test('login to douyin - run this once to save login state', async ({ page, context }) => {
  // Set timeout to 15 minutes for this specific test
  test.setTimeout(15 * 60 * 1000);
  
  // Also set page timeout to ensure all operations have enough time
  page.setDefaultTimeout(10 * 60 * 1000);
  
  await performLogin(page, context, {
    platform: 'Douyin',
    loginUrl: 'https://creator.douyin.com/',
    loginIndicators: [
      // Douyin creator center login indicators - more specific selectors
      'text=创作中心',
      'text=发布作品',
      'text=数据',
      'text=内容管理',
      '[data-e2e="user-avatar"]',
      // More specific user info selectors
      '[class*="header-user"]:has([class*="avatar"])',
    ],
    notLoggedInIndicators: [
      // Indicators that show user is NOT logged in
      'text=登录',
      'button:has-text("登录")',
      'a:has-text("登录")',
      '[class*="login-button"]',
      '[class*="LoginButton"]',
      'text=立即登录',
      'text=请登录',
    ],
    authFilePath: getAuthFilePath('douyin'),
  });
});
