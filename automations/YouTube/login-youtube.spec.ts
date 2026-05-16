import { test } from '@playwright/test';
import path from 'path';
import { mkdirSync } from 'fs';
import { performLogin, getAuthFilePath } from '../utils/login-helper';

/**
 * Login script for YouTube
 * Run this ONCE to login and save your session
 * After login, your session will be saved and reused in other tests
 * 
 * Usage: pnpm login:youtube
 * 
 * Note: This script has NO timeout limit - you can take as long as you need to login.
 * The script will pause and wait for you to complete the login process manually.
 * 
 * Special configuration is used to bypass Google's "browser not secure" detection.
 */

// Set timeout to 15 minutes for login tests to ensure enough time
test.describe.configure({ timeout: 15 * 60 * 1000 }); // 15 minutes

// Use a custom browser context for YouTube to bypass security detection
test.use({
  launchOptions: {
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  },
  contextOptions: {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    permissions: ['geolocation'],
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    colorScheme: 'light' as const,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },
});

test('login to youtube - run this once to save login state', async ({ page, context }) => {
  // Set timeout to 15 minutes for this specific test
  test.setTimeout(15 * 60 * 1000);
  
  // Also set page timeout to ensure all operations have enough time
  page.setDefaultTimeout(10 * 60 * 1000);
  
  // Remove webdriver property to avoid detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    
    // Override the plugins property to use a custom getter
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Override the languages property to use a custom getter
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Override the permissions property
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);
  });
  
  await performLogin(page, context, {
    platform: 'YouTube',
    loginUrl: 'https://accounts.google.com/signin/v2/identifier?service=youtube&continue=https%3A%2F%2Fstudio.youtube.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin',
    loginIndicators: [
      // Primary login success indicator (Chinese YouTube Studio)
      'text=频道信息中心',
      // Logged-in indicators for YouTube Studio
      '[aria-label*="Account"]',
      '[aria-label*="account"]',
      'button[aria-label*="Account"]',
      'button[aria-label*="account"]',
      '[data-testid*="account"]',
      'yt-img-shadow img[alt*="Profile"]',
      'yt-img-shadow img[alt*="profile"]',
      'img[alt*="Profile"]',
      'img[alt*="profile"]',
      // Channel name or user menu
      '[class*="channel-name"]',
      '[class*="ChannelName"]',
      'text=Studio',
      // User avatar
      'yt-img-shadow[class*="avatar"]',
      '[class*="avatar"] img',
      // YouTube Studio specific
      'text=YouTube Studio',
      '[href*="/studio"]',
    ],
    notLoggedInIndicators: [
      // Indicators that show user is NOT logged in
      'text=Sign in',
      'text=Sign In',
      'button:has-text("Sign in")',
      'button:has-text("Sign In")',
      'a:has-text("Sign in")',
      'a:has-text("Sign In")',
      '[aria-label*="Sign in"]',
      '[aria-label*="Sign In"]',
      'text=Get started',
      'text=Get Started',
      // Google sign-in page indicators
      'input[type="email"]',
      'input[name="identifier"]',
      'text=Use your Google Account',
    ],
    authFilePath: getAuthFilePath('youtube'),
  });
  
  // Ensure we're on YouTube Studio page before saving state
  const currentUrl = page.url();
  if (!currentUrl.includes('studio.youtube.com')) {
    console.log('🔄 Navigating to YouTube Studio...');
    await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  }
  
  // Assert login success by checking for "频道信息中心"
  console.log('🔍 Verifying login by checking for 频道信息中心...');
  const dashboardText = page.getByText('频道信息中心').first();
  await dashboardText.waitFor({ state: 'visible', timeout: 30000 });
  await test.expect(dashboardText).toBeVisible({ timeout: 30000 });
  console.log('✅ Login verified: 频道信息中心 is visible');
  
  // Ensure authentication state is saved after verification
  // This ensures we save the state from YouTube Studio page, not from Google login page
  const authFilePath = getAuthFilePath('youtube');
  console.log('💾 Saving authentication state to:', authFilePath);
  
  const authDir = path.dirname(authFilePath);
  mkdirSync(authDir, { recursive: true });
  
  await context.storageState({ path: authFilePath });
  console.log('✅ Authentication state saved successfully!');
});
