import { test } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';
import { getAuthFilePath } from '../utils/login-helper';
import { UPLOAD_PATHS } from '../../types/paths';

/**
 * Auto upload video to Weixin Channel (微信视频号)
 * Uses Playwright's default setup with saved login state
 * Automatically reads video and title from configured paths (see types/paths.ts)
 * 
 * Usage: 
 *   pnpm upload:weixin-video
 * 
 * Or override with environment variables:
 *   VIDEO_PATH=out/custom.mp4 VIDEO_TITLE="Custom Title" pnpm upload:weixin-video
 */

interface UploadConfig {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  coverPath?: string;
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

/**
 * Clean title: keep only Chinese characters (Simplified and Traditional)
 * Remove all non-Chinese characters including spaces, numbers, and special characters
 * @param title - Original title string
 * @returns Cleaned title with only Chinese characters
 */
function cleanTitle(title: string): string {
  // Match Chinese characters (Simplified and Traditional Chinese)
  // Unicode ranges:
  // \u4e00-\u9fff: CJK Unified Ideographs (most common)
  // \u3400-\u4dbf: CJK Extension A
  // \uf900-\ufaff: CJK Compatibility Ideographs
  const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
  
  // Extract only Chinese characters
  const chineseChars = title.match(chinesePattern);
  
  if (!chineseChars || chineseChars.length === 0) {
    console.log('⚠️  Warning: No Chinese characters found in title');
    return '';
  }
  
  // Join Chinese characters together (no spaces)
  const cleaned = chineseChars.join('');
  
  return cleaned;
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
  let originalTitle = process.env.VIDEO_TITLE || getTitleFromJson();
  
  if (!originalTitle) {
    throw new Error(
      'VIDEO_TITLE is required. Please set it:\n' +
      '  export VIDEO_TITLE="Your Video Title"\n' +
      `Or ensure ${UPLOAD_PATHS.DEFAULT_TITLE_JSON} exists with a title field.`
    );
  }
  
  // Clean title: keep only Chinese characters (Simplified and Traditional)
  let cleanedTitle = cleanTitle(originalTitle);
  
  if (!cleanedTitle) {
    throw new Error(
      'Title contains no Chinese characters. Please provide a title with Chinese text.'
    );
  }
  
  if (cleanedTitle !== originalTitle) {
    console.log(`📝 Title cleaned (only Chinese characters kept):`);
    console.log(`   Original: ${originalTitle}`);
    console.log(`   Cleaned: ${cleanedTitle}`);
  }
  
  // Weixin Channel requires title to be exactly 16 Chinese characters
  const MAX_TITLE_LENGTH = 16;
  
  let title = cleanedTitle;
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.substring(0, MAX_TITLE_LENGTH); // Truncate to exactly 16 characters
    console.log(`📝 Title truncated for Weixin (max ${MAX_TITLE_LENGTH} chars):`);
    console.log(`   Cleaned: ${cleanedTitle}`);
    console.log(`   Final: ${title} (${title.length} chars)`);
  } else if (title.length < MAX_TITLE_LENGTH) {
    console.log(`📝 Title length: ${title.length} chars (max ${MAX_TITLE_LENGTH}): ${title}`);
  } else {
    console.log(`📝 Title length OK (${title.length} chars): ${title}`);
  }
  
  // Use full original title as description (with all special characters)
  let description = process.env.VIDEO_DESC || '';
  if (!description) {
    description = originalTitle; // Use full original title as description
    console.log(`📝 Using full original title as description: ${description}`);
  }
  
  const config: UploadConfig = {
    videoPath: path.resolve(videoPath),
    title,
    description,
    tags: process.env.VIDEO_TAGS ? process.env.VIDEO_TAGS.split(',').map(t => t.trim()) : [],
    coverPath: process.env.VIDEO_COVER ? path.resolve(process.env.VIDEO_COVER) : undefined,
  };
  
  return config;
}

// Load saved authentication state for Weixin if it exists
const weixinAuthFile = getAuthFilePath('weixin');
if (existsSync(weixinAuthFile)) {
  test.use({ storageState: weixinAuthFile });
  console.log('Auth: Weixin');
} else {
  console.log('Auth: Weixin Video (not found, run: pnpm login:weixin-video)');
}

// Configure test suite: 10 minute timeout
test.describe.configure({ timeout: 10 * 60 * 1000 });

test('upload video to weixin channel', async ({ page }) => {
  // Set timeout for this specific test (10 minutes)
  test.setTimeout(10 * 60 * 1000);
  
  const config = getUploadConfig();
  
  console.log(`Upload: Weixin - ${config.title}`);
  
  // Step 1: Navigate to Weixin Channel upload page
  await page.goto('https://channels.weixin.qq.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check if logged in
  const loginRequired = await page.locator('text=登录').first().isVisible().catch(() => false);
  const loginButton = await page.locator('button:has-text("登录")').first().isVisible().catch(() => false);
  
  if (loginRequired || loginButton) {
    throw new Error(
      'Not logged in! Please run login script first:\n' +
      '  pnpm login:weixin-video'
    );
  }
  
  console.log('✅ Logged in successfully (using saved session)');

  // Step 2: Click "发表视频" button first
  console.log('🔍 Looking for "发表视频" button...');
  await page.waitForTimeout(2000);
  debugger;
  
  // Try to find and click "发表视频" button (priority selectors)
  const publishSelectors = [
    'text=发表',
    'button:has-text("发表")',
    'a:has-text("发表视频")',
    'text=发布视频',
    'button:has-text("发布视频")',
    'a:has-text("发布视频")',
    'text=发布',
    'button:has-text("发布")',
    '[class*="publish"]',
    '[class*="Publish"]',
  ];
  
  let publishClicked = false;
  for (const selector of publishSelectors) {
    try {
      const button = page.locator(selector).first();
      const visible = await button.isVisible({ timeout: 5000 });
      if (visible) {
        console.log(`✅ Found publish button: ${selector}`);
        await button.click();
        publishClicked = true;
        console.log('✅ Clicked "发表视频" button, waiting for upload form...');
        await page.waitForTimeout(3000); // Wait for upload form to appear
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (!publishClicked) {
    // Try navigating directly to upload page
    console.log('💡 Publish button not found, trying direct navigation...');
    await page.goto('https://channels.weixin.qq.com/publish', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  } else {
    // Wait for upload form to appear after clicking publish button
    console.log('⏳ Waiting for upload form to appear...');
    await page.waitForTimeout(2000);
  }
  
  // Step 3: Wait for upload area to appear
  console.log('📤 Waiting for upload area to appear...');
  await page.waitForTimeout(2000);
  
  // Wait for the upload component to be visible (using stable selectors from HTML structure)
  try {
    // Wait for upload container to appear
    await page.locator('.upload, .ant-upload-drag').first().waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Upload area is visible');
  } catch (e) {
    console.log('⚠️  Upload area not found, continuing...');
  }
  
  // Step 4: Find file input element using stable selectors
  console.log('📤 Looking for upload file input...');
  
  // Priority selectors based on the HTML structure provided
  const fileInputSelectors = [
    // Most specific: ant-upload file input with video accept
    '.ant-upload input[type="file"][accept*="video"]',
    '.ant-upload input[type="file"]',
    // General upload area file input
    '.upload input[type="file"][accept*="video"]',
    '.upload input[type="file"]',
    // Fallback selectors
    'input[type="file"][accept*="video"]',
    'input[type="file"][accept*="mp4"]',
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
  
  // Step 5: Upload video file
  console.log(`📁 Uploading video: ${config.videoPath}`);
  
  if (uploadInput) {
    try {
      await uploadInput.setInputFiles(config.videoPath);
      console.log('✅ Video file selected via input element');
    } catch (error: any) {
      console.log(`⚠️  Error with input element: ${error.message}`);
      uploadInput = null;
    }
  }
  
  // If input not found or failed, try clicking upload area and using file chooser
  if (!uploadInput) {
    console.log('💡 Trying file chooser method with stable selectors...');
    const uploadAreaSelectors = [
      // Most stable selectors from HTML structure
      '.ant-upload-drag-container',
      '.ant-upload-btn',
      '.ant-upload-drag',
      '.upload-wrap',
      '.post-upload-wrap',
      '.upload',
      // Fallback selectors
      '[class*="upload-area"]',
      '[class*="upload-zone"]',
      '[class*="drop-zone"]',
      'text=上传时长8小时内', // Upload tip text as fallback
    ];
    
    for (const selector of uploadAreaSelectors) {
      try {
        const area = page.locator(selector).first();
        if (await area.isVisible({ timeout: 3000 })) {
          console.log(`💡 Clicking upload area: ${selector}`);
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            area.click(),
          ]);
          await fileChooser.setFiles(config.videoPath);
          console.log(`✅ Video file selected via upload area: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  // Wait for video to start uploading
  console.log('⏳ Waiting for video upload to start...');
  await page.waitForTimeout(5000);
  
  // Step 5: Fill in video information
  console.log('✏️  Waiting for form to appear...');
  await page.waitForTimeout(5000);
  
  // Scroll down to see form fields
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(2000);
  
  console.log('✏️  Filling in video information...');
  
  // Fill title
  const titleSelectors = [
    'input[placeholder*="视频标题"]',
    'input[placeholder*="标题"]',
    'input[placeholder*="title"]',
    'textarea[placeholder*="视频标题"]',
    'textarea[placeholder*="标题"]',
    'input[name="title"]',
    '[class*="title-input"] input',
    '[class*="TitleInput"] input',
    '[class*="title"] input[type="text"]',
    '[class*="Title"] input',
    'input[maxlength]',
  ];
  
  let titleFilled = false;
  for (const selector of titleSelectors) {
    try {
      const titleInput = page.locator(selector).first();
      const count = await titleInput.count();
      if (count > 0) {
        const visible = await titleInput.isVisible({ timeout: 2000 });
        if (visible) {
          await titleInput.click({ timeout: 1000 });
          await page.waitForTimeout(500);
          await titleInput.fill(config.title);
          console.log(`✅ Title filled using selector: ${selector}`);
          titleFilled = true;
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (!titleFilled) {
    console.log('⚠️  Title input not found automatically. Please fill manually.');
  }
  
  // Fill description (always fill if provided, or if we have full title as description)
  if (config.description) {
    console.log(`📝 Filling description: ${config.description.substring(0, 50)}${config.description.length > 50 ? '...' : ''}`);
    
    let descFilled = false;
    
    // First, try to find contenteditable div for "视频描述" (based on actual HTML structure)
    // Structure: .form-item:has(.label:has-text("视频描述")) .input-editor[contenteditable]
    const descSelectors = [
      // Most specific: contenteditable input-editor within form-item with "视频描述" label
      '.form-item:has(.label:has-text("视频描述")) .input-editor[contenteditable]',
      '.form-item:has(.label:has-text("视频描述")) .post-desc-box .input-editor',
      '.form-item:has(.label:has-text("视频描述")) [contenteditable]',
      // Using data-placeholder
      '[data-placeholder="添加描述"].input-editor',
      '[data-placeholder*="描述"].input-editor',
      // Using class structure
      '.post-desc-box .input-editor[contenteditable]',
      '.post-desc-box [contenteditable]',
      // General contenteditable selectors
      '.input-editor[contenteditable]',
      // Fallback: traditional input/textarea
      'textarea[placeholder*="视频描述"]',
      'input[placeholder*="视频描述"]',
      '.form-item:has(.label:has-text("视频描述")) textarea',
      '.form-item:has(.label:has-text("视频描述")) input',
      'textarea[placeholder*="描述"]',
      'textarea[placeholder*="简介"]',
    ];
    
    for (const selector of descSelectors) {
      try {
        const descInput = page.locator(selector).first();
        const count = await descInput.count();
        if (count > 0) {
          const visible = await descInput.isVisible({ timeout: 2000 });
          if (visible) {
            await descInput.click({ timeout: 1000 });
            await page.waitForTimeout(500);
            
            // For contenteditable elements, use fill() method (Playwright handles it)
            // If fill() doesn't work, fallback to evaluate()
            try {
              await descInput.fill(config.description);
              console.log(`✅ Description filled using selector: ${selector}`);
            } catch (fillError: any) {
              // Fallback: use evaluate to set textContent for contenteditable
              await descInput.evaluate((el: any, text: string) => {
                el.textContent = text;
                // Trigger input event to notify the framework
                const event = new Event('input', { bubbles: true });
                el.dispatchEvent(event);
              }, config.description);
              console.log(`✅ Description filled using evaluate() for selector: ${selector}`);
            }
            
            descFilled = true;
            await page.waitForTimeout(500);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Try using getByText to find label, then navigate to contenteditable
    if (!descFilled) {
      try {
        const label = page.getByText('视频描述', { exact: false }).first();
        const visible = await label.isVisible({ timeout: 2000 });
        if (visible) {
          // Navigate to parent form-item, then find contenteditable
          const formItem = label.locator('..').locator('..'); // Go up to .form-item
          const descInput = formItem.locator('.input-editor[contenteditable], [contenteditable]').first();
          const count = await descInput.count();
          if (count > 0) {
            await descInput.click({ timeout: 1000 });
            await page.waitForTimeout(500);
            try {
              await descInput.fill(config.description);
            } catch (fillError: any) {
              await descInput.evaluate((el: any, text: string) => {
                el.textContent = text;
                const event = new Event('input', { bubbles: true });
                el.dispatchEvent(event);
              }, config.description);
            }
            console.log(`✅ Description filled using getByText('视频描述') + contenteditable`);
            descFilled = true;
            await page.waitForTimeout(500);
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!descFilled) {
      console.log('⚠️  Description input not found automatically. Please fill manually.');
    }
  } else {
    console.log('💡 No description provided - skipping description field');
  }
  
  // Handle location field: click and select "不显示位置"
  console.log('📍 Handling location field...');
  await page.waitForTimeout(1000);
  
  // Click on position display area to open the dropdown
  const locationSelectors = [
    // Most specific selectors from HTML structure
    '.position-display-wrap',
    '.position-display',
    '.place',
    '.location-name',
    // Fallback selectors
    'text=位置',
    '.form-item:has-text("位置")',
    '[class*="position"]',
  ];
  
  let locationHandled = false;
  for (const selector of locationSelectors) {
    try {
      const locationElement = page.locator(selector).first();
      if (await locationElement.isVisible({ timeout: 3000 })) {
        console.log(`✅ Found location element: ${selector}`);
        await locationElement.click();
        await page.waitForTimeout(1500); // Wait for dropdown to appear
        
        // Look for "不显示位置" option using stable selectors from HTML
        const noLocationSelectors = [
          // Most specific: option-item with "不显示位置" text
          '.option-item:has-text("不显示位置")',
          '.location-item:has-text("不显示位置")',
          '.name:has-text("不显示位置")',
          // Text-based selectors
          'text=不显示位置',
          // Check if first option-item is already active (might already be selected)
          '.option-item.active .name:has-text("不显示位置")',
        ];
        
        for (const noLocationSelector of noLocationSelectors) {
          try {
            const noLocationOption = page.locator(noLocationSelector).first();
            if (await noLocationOption.isVisible({ timeout: 2000 })) {
              // Check if it's already selected (has active class)
              const isActive = await noLocationOption.locator('..').first().evaluate((el: any) => {
                return el.classList?.contains('active') || false;
              }).catch(() => false);
              
              if (!isActive) {
                await noLocationOption.click();
                console.log(`✅ Selected "不显示位置" using: ${noLocationSelector}`);
              } else {
                console.log(`✅ "不显示位置" is already selected`);
              }
              locationHandled = true;
              await page.waitForTimeout(500);
              break;
            }
          } catch (e) {
            // Continue
          }
        }
        
        if (locationHandled) {
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (!locationHandled) {
    console.log('⚠️  Location field not found or "不显示位置" option not available. Skipping...');
  }
  
  // Wait for "取消上传" to appear (upload started), then wait for it to disappear (upload done)
  console.log('⏳ Waiting for "取消上传" to appear (upload in progress)...');
  try {
    await page.getByText('取消上传').first().waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ "取消上传" visible, waiting for it to disappear (upload to finish)...');
    await page.getByText('取消上传').first().waitFor({ state: 'hidden', timeout: 120000 });
    console.log('✅ "取消上传" disappeared, upload finished.');
  } catch (e) {
    console.log('⚠️  "取消上传" not found or timeout, continuing after short wait...');
    await page.waitForTimeout(5000);
  }

  // Step 6: Click submit button
  console.log('');
  console.log('📝 Video upload/form filling completed!');
  console.log('🚀 Looking for submit button...');
  await page.waitForTimeout(2000);

  // Scroll to bottom to ensure submit button is visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Try to find submit button
  let submitClicked = false;

  // First, try using getByRole for '发表' button (most reliable)
  try {
    const submitButton = page.getByRole('button', { name: '发表' });
    const visible = await submitButton.isVisible({ timeout: 5000 });
    if (visible) {
      const isEnabled = await submitButton.isEnabled().catch(() => false);
      if (isEnabled) {
        console.log(`✅ Found submit button: getByRole('button', { name: '发表' })`);
        await submitButton.click();
        console.log('✅ Submit button clicked!');
        submitClicked = true;
        await page.waitForTimeout(2000);
      } else {
        console.log(`⚠️  Submit button found but disabled: getByRole('button', { name: '发表' })`);
      }
    }
  } catch (e) {
    console.log('⚠️  getByRole("发表") not found, trying other selectors...');
  }
  
  // Fallback: try using getByText for '发表' or other texts
  if (!submitClicked) {
    const submitTexts = ['发表', '立即发布', '发布', '确认发布', '提交'];
    for (const submitText of submitTexts) {
      try {
        const submitButton = page.getByText(submitText).first();
        const visible = await submitButton.isVisible({ timeout: 3000 });
        if (visible) {
          const isEnabled = await submitButton.isEnabled().catch(() => false);
          if (isEnabled) {
            console.log(`✅ Found submit button: getByText('${submitText}')`);
            await submitButton.click();
            console.log('✅ Submit button clicked!');
            submitClicked = true;
            await page.waitForTimeout(2000);
            break;
          } else {
            console.log(`⚠️  Submit button found but disabled: getByText('${submitText}')`);
          }
        }
      } catch (e) {
        // Continue to next text
      }
    }
  }
  
  if (!submitClicked) {
    await page.pause();
  } else {
    // Wait for submission to complete
    await page.waitForTimeout(5000);
    
    
    console.log('Success: Weixin');
  }

});
