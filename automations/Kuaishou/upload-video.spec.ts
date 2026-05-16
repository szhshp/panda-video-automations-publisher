import { test, expect } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';
import { getAuthFilePath } from '../utils/login-helper';
import { UPLOAD_PATHS } from '../../types/paths';

/**
 * Auto upload video to Kuaishou (快手)
 * Uses Playwright's default setup with saved login state
 * Automatically reads video and title from configured paths (see types/paths.ts)
 * 
 * Usage: 
 *   pnpm upload:kuaishou
 * 
 * Or override with environment variables:
 *   VIDEO_PATH=out/custom.mp4 VIDEO_TITLE="Custom Title" pnpm upload:kuaishou
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
  
  // Combine title and description for Kuaishou (uses single contenteditable div)
  const description = process.env.VIDEO_DESC || '';
  const combinedText = description ? `${title}\n${description}` : title;
  
  const config: UploadConfig = {
    videoPath: path.resolve(videoPath),
    title: combinedText, // Store combined text in title field
    description: '', // Not used separately for Kuaishou
    tags: process.env.VIDEO_TAGS ? process.env.VIDEO_TAGS.split(',').map(t => t.trim()) : [],
    coverPath: process.env.VIDEO_COVER ? path.resolve(process.env.VIDEO_COVER) : undefined,
  };
  
  return config;
}

// Configure test suite: 10 minute timeout (Kuaishou upload may take longer)
// Load saved authentication state for Kuaishou if it exists
const kuaishouAuthFile = getAuthFilePath('kuaishou');
if (existsSync(kuaishouAuthFile)) {
  test.use({ storageState: kuaishouAuthFile });
  console.log('Auth: Kuaishou');
} else {
  console.log('Auth: Kuaishou (not found, run: pnpm login:kuaishou)');
}

test.describe.configure({ timeout: 10 * 60 * 1000 });

test('upload video to kuaishou', async ({ page }) => {
  // Set timeout for this specific test (10 minutes)
  test.setTimeout(10 * 60 * 1000);
  
  const config = getUploadConfig();
  
  console.log(`Upload: Kuaishou - ${config.title}`);
  
  // Step 1: Navigate to Kuaishou creator upload page
  await page.goto('https://cp.kuaishou.com/article/publish/video?origin=www.kuaishou.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // Wait for page to fully load
  
  // Check if logged in
  const loginRequired = await page.locator('text=登录').first().isVisible().catch(() => false);
  const loginButton = await page.locator('button:has-text("登录")').first().isVisible().catch(() => false);
  
  if (loginRequired || loginButton) {
    throw new Error(
      'Not logged in! Please run login script first:\n' +
      '  pnpm login:kuaishou'
    );
  }
  
  console.log('✅ Logged in successfully (using saved session)');
  
  // Step 2: Find the upload area/button
  console.log('📤 Looking for upload area...');
  await page.waitForTimeout(2000);
  
  // Try to find upload button or area
  const uploadSelectors = [
    'button:has-text("上传视频")',
    'button:has-text("上传")',
    'button:has-text("选择视频")',
    '[class*="upload"]',
    '[class*="Upload"]',
    '[data-e2e="upload-button"]',
    'text=上传视频',
    'text=选择视频',
    'text=点击上传',
  ];
  
  let uploadButton = null;
  for (const selector of uploadSelectors) {
    try {
      const button = page.locator(selector).first();
      const visible = await button.isVisible({ timeout: 2000 });
      if (visible) {
        uploadButton = button;
        console.log(`✅ Found upload button: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Step 3: Find file input element
  console.log('📤 Looking for upload file input...');
  await page.waitForTimeout(1000);
  
  const fileInputSelectors = [
    'input[type="file"]',
    'input[accept*="video"]',
    '[class*="upload"] input[type="file"]',
    '[class*="Upload"] input[type="file"]',
    'input[accept*="mp4"]',
  ];
  
  let uploadInput = null;
  for (const selector of fileInputSelectors) {
    try {
      const input = page.locator(selector).first();
      const count = await input.count();
      if (count > 0) {
        // File inputs are often hidden, so check if element exists
        uploadInput = input;
        console.log(`✅ Found file input: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Step 4: Upload video file
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
  
  // If input not found or failed, try clicking upload button and using file chooser
  if (!uploadInput && uploadButton) {
    try {
      console.log('💡 Trying file chooser method...');
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        uploadButton.click(),
      ]);
      await fileChooser.setFiles(config.videoPath);
      console.log('✅ Video file selected via file chooser');
    } catch (error: any) {
      console.log(`⚠️  File chooser method failed: ${error.message}`);
    }
  }
  
  // If still no success, try clicking upload area
  if (!uploadInput) {
    console.log('💡 Trying to click upload area...');
    const uploadAreaSelectors = [
      '[class*="upload-area"]',
      '[class*="upload-zone"]',
      '[class*="UploadArea"]',
      '[class*="drop-zone"]',
      'div[class*="upload"]',
      '[class*="upload-wrapper"]',
    ];
    
    for (const selector of uploadAreaSelectors) {
      try {
        const area = page.locator(selector).first();
        if (await area.isVisible({ timeout: 2000 })) {
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
  
  // Step 4.5: Check for Skip button and click if present
  console.log('🔍 Checking for Skip button...');
  await page.waitForTimeout(2000);
  
  const skipButtonSelectors = [
    'div[aria-label="Skip"][data-action="skip"][role="button"]',
    'div[aria-label="Skip"]',
    'div[data-action="skip"]',
    '[role="button"][title="Skip"]',
    'div[title="Skip"]',
  ];
  
  let skipClicked = false;
  for (const selector of skipButtonSelectors) {
    try {
      const skipButton = page.locator(selector).first();
      const visible = await skipButton.isVisible({ timeout: 3000 });
      if (visible) {
        console.log(`✅ Found Skip button: ${selector}`);
        await skipButton.click();
        console.log('✅ Skip button clicked!');
        skipClicked = true;
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (!skipClicked) {
    console.log('ℹ️  No Skip button found (this is normal if not needed)');
  }
  
  // Step 5: Fill in video information
  console.log('✏️  Waiting for form to appear...');
  await page.waitForTimeout(5000);
  
  // Scroll down to see form fields
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(2000);
  
  console.log('✏️  Filling in video information...');
  
  // Fill title + description in contenteditable div (Kuaishou uses single field)
  const descriptionSelectors = [
    '#work-description-edit',
    'div[id="work-description-edit"]',
    'div._description_17g9x_24',
    '[class*="_description_"]',
    'div[contenteditable="true"][id*="description"]',
    'div[contenteditable="true"][placeholder*="作品描述"]',
  ];
  
  let descriptionFilled = false;
  for (const selector of descriptionSelectors) {
    try {
      const descDiv = page.locator(selector).first();
      const count = await descDiv.count();
      if (count > 0) {
        const visible = await descDiv.isVisible({ timeout: 3000 });
        if (visible) {
          await descDiv.click({ timeout: 1000 });
          await page.waitForTimeout(500);
          // Clear existing content and fill with combined title + description
          await descDiv.fill('');
          await page.waitForTimeout(200);
          await descDiv.fill(config.title);
          // Trigger input event to ensure the content is recognized
          await descDiv.evaluate((el) => {
            const event = new Event('input', { bubbles: true });
            el.dispatchEvent(event);
          });
          console.log(`✅ Title + Description filled using selector: ${selector}`);
          descriptionFilled = true;
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (!descriptionFilled) {
    console.log('⚠️  Description contenteditable div not found automatically. Please fill manually.');
  }
  
  // Fill tags if provided (Kuaishou uses hashtags)
  if (config.tags && config.tags.length > 0) {
    await page.waitForTimeout(1000);
    const tagSelectors = [
      'input[placeholder*="话题"]',
      'input[placeholder*="标签"]',
      'input[placeholder*="tag"]',
      'input[placeholder*="hashtag"]',
      '[class*="tag-input"] input',
      '[class*="TagInput"] input',
      '[class*="topic-input"] input',
      '[class*="hashtag"] input',
      'input[type="text"][placeholder*="话题"]',
    ];
    
    let tagsFilled = false;
    for (const selector of tagSelectors) {
      try {
        const tagInput = page.locator(selector).first();
        const count = await tagInput.count();
        if (count > 0) {
          const visible = await tagInput.isVisible({ timeout: 2000 });
          if (visible) {
            await tagInput.click({ timeout: 1000 });
            await page.waitForTimeout(500);
            // Kuaishou tags are usually separated by spaces or # symbol
            const tagsText = config.tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
            await tagInput.fill(tagsText);
            console.log(`✅ Tags filled using selector: ${selector}`);
            tagsFilled = true;
            await page.waitForTimeout(500);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!tagsFilled) {
      console.log('⚠️  Tags input not found automatically. Please fill manually.');
    }
  }
  
  // Step 6: Upload cover if provided
  if (config.coverPath && existsSync(config.coverPath)) {
    console.log(`🖼️  Uploading cover: ${config.coverPath}`);
    await page.waitForTimeout(2000);
    
    const coverSelectors = [
      'input[type="file"][accept*="image"]',
      '[class*="cover-upload"] input',
      '[class*="CoverUpload"] input',
      '[class*="cover"] input[type="file"]',
      '[class*="thumbnail"] input[type="file"]',
      'button:has-text("上传封面")',
      'button:has-text("选择封面")',
    ];
    
    let coverUploaded = false;
    for (const selector of coverSelectors) {
      try {
        if (selector.includes('button')) {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 5000 }),
              button.click(),
            ]);
            await fileChooser.setFiles(config.coverPath);
            console.log('✅ Cover uploaded via button');
            coverUploaded = true;
            await page.waitForTimeout(2000);
            break;
          }
        } else {
          const coverInput = page.locator(selector).first();
          if (await coverInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await coverInput.setInputFiles(config.coverPath);
            console.log(`✅ Cover uploaded using selector: ${selector}`);
            coverUploaded = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!coverUploaded) {
      console.log('⚠️  Cover upload input not found automatically. Please upload manually.');
    }
  }
  
  // Step 7: Wait for video processing
  console.log('⏳ Waiting for video to finish uploading/processing...');
  await page.waitForTimeout(10000);
  
  // Check for any processing indicators
  const processingSelectors = [
    'text=处理中',
    'text=上传中',
    'text=转码中',
    '[class*="processing"]',
    '[class*="uploading"]',
  ];
  
  for (const selector of processingSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log('⏳ Video is still processing, waiting longer...');
        await page.waitForTimeout(15000);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Step 8: Click submit/publish button
  console.log('');
  console.log('📝 Video upload/form filling completed!');
  console.log('🚀 Looking for submit/publish button...');
  await page.waitForTimeout(2000);
  
  // Scroll to bottom to ensure submit button is visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  
  
  // Try to find submit/publish button using stable selectors (not relying on random class names)
  let submitClicked = false;
  
  // Method 1: Find button container by class pattern, then find the "发布" button
  try {
    const buttonContainer = page.locator('[class*="edit-section-btns"]').first();
    const containerExists = await buttonContainer.count() > 0;
    if (containerExists) {
      const publishButton = buttonContainer.locator('div:has-text("发布")').first();
      const visible = await publishButton.isVisible({ timeout: 3000 });
      if (visible) {
        console.log('✅ Found publish button in button container');
        await publishButton.click();
        console.log('✅ Publish button clicked!');
        submitClicked = true;
        await page.waitForTimeout(2000);
      }
    }
  } catch (e) {
    // Continue to next method
  }
  
  // Method 2: Find any div containing "发布" text that's clickable
  if (!submitClicked) {
    try {
      // Find divs that contain "发布" and are likely buttons (have button-like structure)
      const publishButtons = page.locator('div:has-text("发布")');
      const count = await publishButtons.count();
      
      for (let i = 0; i < count; i++) {
        const button = publishButtons.nth(i);
        const visible = await button.isVisible({ timeout: 2000 }).catch(() => false);
        if (visible) {
          // Check if it's in a button container (has parent with button classes)
          const parent = button.locator('..');
          const parentClassAttr = await parent.getAttribute('class').catch(() => null);
          const parentClass = parentClassAttr || '';
          
          // Check if it's likely a button (has button-related classes or is clickable)
          if (parentClass.includes('button') || parentClass.includes('Button') || parentClass.includes('primary')) {
            console.log('✅ Found publish button by text content');
            await button.click();
            console.log('✅ Publish button clicked!');
            submitClicked = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
      }
    } catch (e) {
      // Continue to next method
    }
  }
  
  // Method 3: Use getByText to find "发布" and click its parent button element
  if (!submitClicked) {
    try {
      const publishText = page.getByText('发布', { exact: true });
      const visible = await publishText.isVisible({ timeout: 3000 });
      if (visible) {
        // Find the clickable parent (button container)
        const parentButton = publishText.locator('..').locator('..'); // Go up two levels to get button container
        const parentVisible = await parentButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (parentVisible) {
          console.log('✅ Found publish button using getByText');
          await parentButton.click();
          console.log('✅ Publish button clicked!');
          submitClicked = true;
          await page.waitForTimeout(2000);
        } else {
          // Try clicking the text element itself
          await publishText.click();
          console.log('✅ Publish button clicked (via text element)!');
          submitClicked = true;
          await page.waitForTimeout(2000);
        }
      }
    } catch (e) {
      // Continue to fallback
    }
  }
  
  // Fallback: Try other common selectors
  if (!submitClicked) {
    const fallbackSelectors = [
      'button:has-text("发布")',
      'button:has-text("提交")',
      'button:has-text("发布作品")',
      'button:has-text("确认发布")',
      '[role="button"]:has-text("发布")',
      'button[type="submit"]',
    ];
    
    for (const selector of fallbackSelectors) {
      try {
        const submitButton = page.locator(selector).first();
        const visible = await submitButton.isVisible({ timeout: 2000 });
        if (visible) {
          const isEnabled = await submitButton.isEnabled().catch(() => true);
          if (isEnabled) {
            console.log(`✅ Found submit button: ${selector}`);
            await submitButton.click();
            console.log('✅ Submit button clicked!');
            submitClicked = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  if (!submitClicked) {
    console.log('⚠️  Submit button not found automatically.');
    console.log('💡 Pausing for manual review - please click submit button manually');
    await page.pause();
  } else {
    // Wait for submission to complete
    console.log('⏳ Waiting for submission to complete...');
    await page.waitForTimeout(5000);
    
    // Assert "内容发布成功" text appears
    console.log('🔍 Asserting success message: "内容发布成功"...');
    
    // Wait for and assert the success message appears
    await expect(page.getByRole('textbox', { name: '输入搜索关键词' })).toBeVisible();
    console.log('✅ Submission successful!');
    console.log('Success: Kuaishou');
  }
});
