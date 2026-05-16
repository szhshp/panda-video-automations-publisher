import { test, expect } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';
import { getAuthFilePath } from '../utils/login-helper';
import { UPLOAD_PATHS } from '../../types/paths';

/**
 * Auto upload video to Douyin (抖音 - TikTok China)
 * Uses Playwright's default setup with saved login state
 * Automatically reads video and title from configured paths (see types/paths.ts)
 * 
 * Usage: 
 *   pnpm upload:douyin
 * 
 * Or override with environment variables:
 *   VIDEO_PATH=out/custom.mp4 VIDEO_TITLE="Custom Title" pnpm upload:douyin
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

  // Douyin title limit: 30 characters
  const DOUYIN_TITLE_MAX_LENGTH = 30;
  if (title.length > DOUYIN_TITLE_MAX_LENGTH) {
    title = title.substring(0, DOUYIN_TITLE_MAX_LENGTH);
    console.log(`⚠️  Title truncated to ${DOUYIN_TITLE_MAX_LENGTH} characters for Douyin`);
  }

  const config: UploadConfig = {
    videoPath: path.resolve(videoPath),
    title,
    description: process.env.VIDEO_DESC || '',
    tags: process.env.VIDEO_TAGS ? process.env.VIDEO_TAGS.split(',').map(t => t.trim()) : [],
    coverPath: process.env.VIDEO_COVER ? path.resolve(process.env.VIDEO_COVER) : undefined,
  };

  return config;
}

// Configure test suite: 10 minute timeout (Douyin upload may take longer)
// Load saved authentication state for Douyin if it exists
const douyinAuthFile = getAuthFilePath('douyin');
if (existsSync(douyinAuthFile)) {
  test.use({ storageState: douyinAuthFile });
  console.log('Auth: Douyin');
} else {
  console.log('Auth: Douyin (not found, run: pnpm login:douyin)');
}

test.describe.configure({ timeout: 10 * 60 * 1000 });

test('upload video to douyin', async ({ page }) => {
  // Set timeout for this specific test (10 minutes)
  test.setTimeout(10 * 60 * 1000);

  const config = getUploadConfig();

  console.log(`Upload: Douyin - ${config.title}`);

  // Step 1: Navigate to Douyin creator upload page
  await page.goto('https://creator.douyin.com/creator-micro/content/upload');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // Wait for page to fully load

  // Check if logged in
  const loginRequired = await page.locator('text=登录').first().isVisible().catch(() => false);
  const loginButton = await page.locator('button:has-text("登录")').first().isVisible().catch(() => false);

  if (loginRequired || loginButton) {
    throw new Error(
      'Not logged in! Please run login script first:\n' +
      '  pnpm login:douyin'
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
    '[class*="upload"]',
    '[class*="Upload"]',
    '[data-e2e="upload-button"]',
    'text=上传视频',
    'text=选择视频',
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
        const visible = await input.isVisible({ timeout: 1000 }).catch(() => false);
        // File inputs are often hidden, so check if element exists
        if (count > 0) {
          uploadInput = input;
          console.log(`✅ Found file input: ${selector}`);
          break;
        }
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

  // Step 5: Fill in video information
  console.log('✏️  Waiting for form to appear...');
  await page.waitForTimeout(5000);

  // Scroll down to see form fields
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(2000);

  console.log('✏️  Filling in video information...');

  // Fill title
  const titleSelectors = [
    'input[placeholder*="作品标题"]',
    'input[placeholder*="标题"]',
    'input[placeholder*="title"]',
    'textarea[placeholder*="作品标题"]',
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

  // Fill description if provided
  if (config.description) {
    await page.waitForTimeout(1000);
    const descSelectors = [
      'textarea[placeholder*="作品描述"]',
      'textarea[placeholder*="描述"]',
      'textarea[placeholder*="简介"]',
      'textarea[placeholder*="description"]',
      'textarea[name="desc"]',
      'textarea[name="description"]',
      '[class*="desc-input"] textarea',
      '[class*="DescInput"] textarea',
      '[class*="desc"] textarea',
      '[class*="Desc"] textarea',
      'textarea[maxlength]',
    ];

    let descFilled = false;
    for (const selector of descSelectors) {
      try {
        const descInput = page.locator(selector).first();
        const count = await descInput.count();
        if (count > 0) {
          const visible = await descInput.isVisible({ timeout: 2000 });
          if (visible) {
            await descInput.click({ timeout: 1000 });
            await page.waitForTimeout(500);
            await descInput.fill(config.description);
            console.log(`✅ Description filled using selector: ${selector}`);
            descFilled = true;
            await page.waitForTimeout(500);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    if (!descFilled) {
      console.log('⚠️  Description input not found automatically. Please fill manually.');
    }
  }

  // Fill tags if provided (Douyin uses hashtags)
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
            // Douyin tags are usually separated by spaces or # symbol
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
  ];

  let isProcessing = false;
  for (const selector of processingSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        isProcessing = true;
        console.log('⏳ Video is still processing, waiting longer...');
        await page.waitForTimeout(15000);
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  const coCenterBanner = page.getByText('新增「共创中心」模块，管理你的共创作品。');
  if (await coCenterBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('dialog').getByRole('button', { name: '我知道了' }).click();
  }

  // Step 8: Required declaration + publish
  // Open 自主声明 picker, then select "内容为个人观点或见解" before 发布 is allowed.
  console.log('');
  console.log('📝 Video upload/form filling completed!');
  console.log('☑️  Opening self-declaration and selecting "内容为个人观点或见解"...');
  await page.waitForTimeout(2000);

  const selfDeclarationTrigger = page.getByText('请选择自主声明', { exact: true }).first();
  const hasSelfDeclaration = await selfDeclarationTrigger.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasSelfDeclaration) {
    await selfDeclarationTrigger.scrollIntoViewIfNeeded();
    await selfDeclarationTrigger.click();
    await page.waitForTimeout(500);

    const personalOpinionLabel = page.getByRole('radio', { name: '内容为个人观点或见解' });
    await personalOpinionLabel.waitFor({ state: 'visible', timeout: 20000 });
    await personalOpinionLabel.scrollIntoViewIfNeeded();
    await personalOpinionLabel.click({ force: true });

    await page.getByRole('button', { name: '确定' }).click();



    console.log('✅ Content declaration is selected and verified');
  } else {
    console.log('ℹ️  Self-declaration trigger is not visible; skipping optional declaration step.');
  }

  console.log('🚀 Looking for submit/publish button...');
  await page.waitForTimeout(1000);

  // Scroll to bottom to ensure submit button is visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Try to find submit/publish button using getByRole (recommended for Douyin)
  let submitClicked = false;

  try {
    // Use getByRole for Douyin publish button (exact match)
    const submitButton = page.getByRole('button', { name: '发布', exact: true });
    const visible = await submitButton.isVisible({ timeout: 5000 });
    if (visible) {
      const isEnabled = await submitButton.isEnabled().catch(() => false);
      if (isEnabled) {
        console.log('✅ Found publish button using getByRole');
        await submitButton.click();
        console.log('✅ Publish button clicked!');
        submitClicked = true;
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️  Publish button found but disabled');
      }
    }
  } catch (e) {
    console.log('⚠️  Publish button not found with getByRole, trying fallback selectors...');
  }

  // Fallback to other selectors if getByRole fails
  if (!submitClicked) {
    const submitSelectors = [
      'button:has-text("发布")',
      'button:has-text("提交")',
      'button:has-text("发布作品")',
      'button:has-text("确认发布")',
      '[class*="publish-button"]',
      '[class*="submit-button"]',
      '[class*="PublishButton"]',
      '[class*="SubmitButton"]',
      'button[type="submit"]',
      '[data-e2e="publish-button"]',
      '[data-e2e="submit-button"]',
    ];

    for (const selector of submitSelectors) {
      try {
        const submitButton = page.locator(selector).first();
        const visible = await submitButton.isVisible({ timeout: 3000 });
        if (visible) {
          const isEnabled = await submitButton.isEnabled().catch(() => false);
          if (isEnabled) {
            console.log(`✅ Found submit button: ${selector}`);
            await submitButton.click();
            console.log('✅ Submit button clicked!');
            submitClicked = true;
            await page.waitForTimeout(2000);
            break;
          } else {
            console.log(`⚠️  Submit button found but disabled: ${selector}`);
          }
        }
      } catch (e) {
        // Continue checking other selectors
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

    // Check for success indicators
    const successSelectors = [
      'text=发布成功',
      'text=提交成功',
      'text=上传成功',
      '[class*="success"]',
      '[class*="Success"]',
    ];

    let submissionSuccess = false;
    for (const selector of successSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          submissionSuccess = true;
          console.log('✅ Submission successful!');
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!submissionSuccess) {
      console.log('Success: Douyin (check manually)');
    } else {
      console.log('Success: Douyin');
    }
  }
});
