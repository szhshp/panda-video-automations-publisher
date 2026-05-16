import { test, expect } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';
import { getAuthFilePath } from '../utils/login-helper';
import { UPLOAD_PATHS } from '../../types/paths';

/**
 * Auto upload video to YouTube
 * Uses Playwright's default setup with saved login state
 * Automatically reads video and title from configured paths (see types/paths.ts)
 * 
 * Usage: 
 *   pnpm upload:youtube
 * 
 * Or override with environment variables:
 *   VIDEO_PATH=out/custom.mp4 VIDEO_TITLE="Custom Title" pnpm upload:youtube
 */

interface UploadConfig {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  coverPath?: string;
  privacy?: 'public' | 'unlisted' | 'private';
}

// Get video file path (default to fixed filename)
function getVideoPath(): string {
  const defaultVideoPath = path.join(process.cwd(), UPLOAD_PATHS.DEFAULT_VIDEO);
  return process.env.VIDEO_PATH || defaultVideoPath;
}

// Get title from JSON file or environment
function getTitleFromJson(): string | null {
  const titleJsonPath = path.join(process.cwd(), UPLOAD_PATHS.DEFAULT_TITLE_JSON);
  
  if (!existsSync(titleJsonPath)) {
    return null;
  }
  
  try {
    const fs = require('fs');
    const titleData = JSON.parse(fs.readFileSync(titleJsonPath, 'utf-8'));
    return titleData.title || null;
  } catch (e) {
    return null;
  }
}

// Get upload configuration from environment or defaults
function getUploadConfig(): UploadConfig {
  const videoPath = getVideoPath();
  
  if (!videoPath || !existsSync(videoPath)) {
    throw new Error(
      `Video file not found: ${videoPath}\n` +
      `Please ensure ${UPLOAD_PATHS.DEFAULT_VIDEO} exists or set VIDEO_PATH environment variable.`
    );
  }
  
  // Try to get title from JSON file first, then environment variable
  let title = process.env.VIDEO_TITLE || getTitleFromJson();
  
  if (!title) {
    throw new Error(
      'VIDEO_TITLE is required. Please set it:\n' +
      '  export VIDEO_TITLE="Your Video Title"\n' +
      `Or ensure ${UPLOAD_PATHS.DEFAULT_TITLE_JSON} exists with a title field.`
    );
  }
  
  const config: UploadConfig = {
    videoPath: path.resolve(videoPath),
    title,
    description: process.env.VIDEO_DESC || '',
    tags: process.env.VIDEO_TAGS ? process.env.VIDEO_TAGS.split(',').map(t => t.trim()) : [],
    coverPath: process.env.VIDEO_COVER ? path.resolve(process.env.VIDEO_COVER) : undefined,
    privacy: (process.env.VIDEO_PRIVACY as 'public' | 'unlisted' | 'private') || 'unlisted',
  };
  
  return config;
}

// Load saved authentication state for YouTube if it exists
const youtubeAuthFile = getAuthFilePath('youtube');
if (existsSync(youtubeAuthFile)) {
  test.use({ storageState: youtubeAuthFile });
  console.log('Auth: YouTube');
} else {
  console.log('Auth: YouTube (not found, run: pnpm login:youtube)');
}

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

// Configure test suite: 10 minute timeout
test.describe.configure({ timeout: 10 * 60 * 1000 });

test('upload video to youtube', async ({ page }) => {
  // Set timeout for this specific test (10 minutes)
  test.setTimeout(10 * 60 * 1000);
  
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
  
  const config = getUploadConfig();
  
  console.log(`Upload: YouTube - ${config.title}`);
  
  // Step 1: Navigate directly to YouTube Studio upload page
  console.log('🌐 Navigating to YouTube Studio upload page...');
  await page.goto('https://studio.youtube.com/channel/me/videos/upload', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  // Check if logged in
  const loginRequired = await page.locator('text=Sign in').first().isVisible().catch(() => false);
  const loginRequiredCN = await page.locator('text=登录').first().isVisible().catch(() => false);
  if (loginRequired || loginRequiredCN) {
    throw new Error(
      'Not logged in! Please run login script first:\n' +
      '  pnpm login:youtube'
    );
  }
  
  console.log('✅ Logged in successfully (using saved session)');
  
  // Step 2: Wait for upload page to load
  console.log('⏳ Waiting for upload page to load...');
  await page.waitForTimeout(3000);
  
  // Step 3: Click "创建" button to open upload dialog
  console.log('📤 Opening upload dialog...');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '创建' }).click();
  await page.waitForTimeout(1000);
  
  // Step 4: Click "上传视频" to open file picker
  await page.getByText('上传视频').click();
  await page.waitForTimeout(2000);

  // Step 5: Select video file
  console.log(`📁 Uploading video: ${config.videoPath}`);
  
  // Try to find the actual file input element first
  const fileInputSelectors = [
    '#ytcp-uploads-dialog-file-picker input[type="file"]',
    '#ytcp-uploads-dialog-file-picker input[accept*="video"]',
    'input[type="file"][accept*="video"]',
    'input[type="file"]',
  ];
  
  let uploadInput = null;
  for (const selector of fileInputSelectors) {
    try {
      const input = page.locator(selector).first();
      const count = await input.count();
      if (count > 0) {
        uploadInput = input;
        console.log(`✅ Found file input: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Method 1: Try direct file input if found
  if (uploadInput) {
    try {
      await uploadInput.setInputFiles(config.videoPath);
      console.log('✅ Video file selected via input element');
      await page.waitForTimeout(3000);
    } catch (error: any) {
      console.log(`⚠️  Error with input element: ${error.message}`);
      uploadInput = null;
    }
  }
  
  // Method 2: If input not found or failed, use file chooser event
  if (!uploadInput) {
    try {
      console.log('💡 Trying file chooser method...');
      const uploadButton = page.locator('#ytcp-uploads-dialog-file-picker').first();
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        uploadButton.click(),
      ]);
      await fileChooser.setFiles(config.videoPath);
      console.log('✅ Video file selected via file chooser');
      await page.waitForTimeout(3000);
    } catch (error: any) {
      console.log(`❌ File chooser method failed: ${error.message}`);
      throw new Error(`Failed to upload video file: ${error.message}`);
    }
  }

  // Step 6: Wait for upload form to appear after video selection
  console.log('⏳ Waiting for upload form to appear...');
  await page.waitForTimeout(5000);

  // Step 7: Fill in video information (title, description, tags, privacy)
  console.log('✏️  Filling in video information...');
  
  const titleSelectors = [
    'input[aria-label*="Title"]',
    'input[aria-label*="title"]',
    'input[aria-label*="标题"]',
    '#textbox[aria-label*="Title"]',
    '#textbox[aria-label*="title"]',
    '#textbox[aria-label*="标题"]',
    'input[name="title"]',
    '[id*="title"] input',
    '[id*="Title"] input',
    '[class*="title"] input',
    '[class*="Title"] input',
  ];
  
  let titleFilled = false;
  for (const selector of titleSelectors) {
    try {
      const titleInput = page.locator(selector).first();
      const visible = await titleInput.isVisible({ timeout: 10000 });
      if (visible) {
        console.log(`✅ Found title input: ${selector}`);
        await titleInput.click({ timeout: 2000 });
        await titleInput.fill(config.title);
        titleFilled = true;
        console.log(`✅ Title filled: ${config.title}`);
        await page.waitForTimeout(500);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (!titleFilled) {
    console.log('⚠️  Warning: Could not find title input');
  }
  
  // Fill description if provided
  if (config.description) {
    const descSelectors = [
      'textarea[aria-label*="Description"]',
      'textarea[aria-label*="description"]',
      'textarea[aria-label*="描述"]',
      '#textbox[aria-label*="Description"]',
      '#textbox[aria-label*="description"]',
      '#textbox[aria-label*="描述"]',
      'textarea[name="description"]',
      '[id*="description"] textarea',
      '[class*="description"] textarea',
    ];
    
    for (const selector of descSelectors) {
      try {
        const descInput = page.locator(selector).first();
        const visible = await descInput.isVisible({ timeout: 5000 });
        if (visible) {
          console.log(`✅ Found description input: ${selector}`);
          await descInput.click({ timeout: 2000 });
          await descInput.fill(config.description);
          console.log('✅ Description filled');
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  // Fill tags if provided
  if (config.tags && config.tags.length > 0) {
    const tagSelectors = [
      'input[aria-label*="Tags"]',
      'input[aria-label*="tags"]',
      'input[aria-label*="标签"]',
      '#textbox[aria-label*="Tags"]',
      '#textbox[aria-label*="tags"]',
      '#textbox[aria-label*="标签"]',
      'input[placeholder*="tag"]',
      'input[placeholder*="标签"]',
      '[id*="tag"] input',
      '[class*="tag"] input',
    ];
    
    for (const selector of tagSelectors) {
      try {
        const tagInput = page.locator(selector).first();
        const visible = await tagInput.isVisible({ timeout: 5000 });
        if (visible) {
          console.log(`✅ Found tags input: ${selector}`);
          await tagInput.click({ timeout: 2000 });
          await tagInput.fill(config.tags.join(','));
          console.log(`✅ Tags filled: ${config.tags.join(',')}`);
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  // Step 8: Set privacy/visibility (default to unlisted)
  console.log(`🔒 Setting privacy to: ${config.privacy}`);
  await page.waitForTimeout(2000);
  
  const privacySelectors = [
    'button[aria-label*="Visibility"]',
    'button[aria-label*="visibility"]',
    'button[aria-label*="可见性"]',
    '[id*="privacy"] button',
    '[class*="privacy"] button',
    'yt-button-shape:has-text("Public")',
    'yt-button-shape:has-text("Unlisted")',
    'yt-button-shape:has-text("Private")',
    'yt-button-shape:has-text("公开")',
    'yt-button-shape:has-text("不公开列出")',
    'yt-button-shape:has-text("私人")',
  ];
  
  // Click privacy button to open dropdown
  for (const selector of privacySelectors) {
    try {
      const privacyButton = page.locator(selector).first();
      const visible = await privacyButton.isVisible({ timeout: 5000 });
      if (visible) {
        console.log(`✅ Found privacy button: ${selector}`);
        await privacyButton.click();
        await page.waitForTimeout(1000);
        
        // Select the desired privacy option (support both English and Chinese)
        const privacyText = config.privacy === 'public' ? 'Public' : config.privacy === 'private' ? 'Private' : 'Unlisted';
        const privacyTextCN = config.privacy === 'public' ? '公开' : config.privacy === 'private' ? '私人' : '不公开列出';
        const privacyOptionSelectors = [
          `text=${privacyText}`,
          `text=${privacyTextCN}`,
          `yt-button-shape:has-text("${privacyText}")`,
          `yt-button-shape:has-text("${privacyTextCN}")`,
          `[aria-label*="${privacyText}"]`,
          `[aria-label*="${privacyTextCN}"]`,
        ];
        
        for (const optionSelector of privacyOptionSelectors) {
          try {
            const option = page.locator(optionSelector).first();
            const optionVisible = await option.isVisible({ timeout: 3000 });
            if (optionVisible) {
              await option.click();
              console.log(`✅ Privacy set to: ${privacyText}`);
              await page.waitForTimeout(1000);
              break;
            }
          } catch (e) {
            // Continue
          }
        }
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  await page.getByRole('radio', { name: '不，内容不是面向儿童的' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('radio', { name: '公开', exact: true }).click();
  await page.getByRole('button', { name: '发布' }).click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByLabel(config.title, { exact: true })).toBeVisible();

});
