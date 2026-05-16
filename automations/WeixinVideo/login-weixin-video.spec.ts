import { test } from '@playwright/test';
import { getAuthFilePath } from '../utils/login-helper';
import path from 'path';
import { mkdirSync, existsSync, unlinkSync, statSync } from 'fs';

/**
 * Login script for Weixin Channel (微信视频号)
 * Run this ONCE to login and save your session
 * After login, your session will be saved and reused in other tests
 * 
 * Usage: pnpm login:weixin-video
 * 
 * Login page: https://channels.weixin.qq.com/login.html
 * 
 * Note: This script will automatically wait for "昨日数据" text to appear (up to 15 minutes).
 * Please complete the login process manually in the browser.
 */

// Set timeout to 15 minutes for login tests to ensure enough time
test.describe.configure({ timeout: 15 * 60 * 1000 }); // 15 minutes

test('login to weixin channel - run this once to save login state', async ({ page, context }) => {
  // Set timeout to 15 minutes for this specific test
  test.setTimeout(15 * 60 * 1000);
  
  // Also set page timeout to ensure all operations have enough time
  page.setDefaultTimeout(10 * 60 * 1000);
  
  // Navigate to login page first
  console.log('🌐 Opening Weixin Channel login page...');
  await page.goto('https://channels.weixin.qq.com/login.html', { 
    waitUntil: 'domcontentloaded',
    timeout: 10 * 60 * 1000
  });
  
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  console.log('');
  console.log('🔐 ============================================');
  console.log('🔐 Please login to Weixin Channel manually');
  console.log('🔐 The script will automatically wait for "昨日数据" to appear');
  console.log('🔐 Maximum wait time: 15 minutes');
  console.log('🔐 ============================================');
  console.log('');
  
  // Wait for "昨日数据" text to appear (this indicates successful login)
  console.log('⏳ Waiting for "昨日数据" text to appear (this means login is successful)...');
  
  try {
    const yesterdayData = page.getByText('昨日数据').first();
    await yesterdayData.waitFor({ state: 'visible', timeout: 15 * 60 * 1000 }); // 15 minutes timeout

    console.log('✅ Login successful! Found "昨日数据" indicator.');
    
    // Wait a bit more to ensure page is fully loaded and cookies are set
    console.log('⏳ Waiting for page to fully load...');
    await page.waitForTimeout(3000);
    
    // Check current URL to ensure we're on the right page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Save authentication state
    console.log('💾 Saving authentication state...');
    const authFilePath = getAuthFilePath('weixin');
    console.log(`📁 Auth file path: ${authFilePath}`);
    
    // Delete old auth file if exists to ensure fresh save
    if (existsSync(authFilePath)) {
      console.log(`🗑️  Deleting old auth file: ${authFilePath}`);
      unlinkSync(authFilePath);
    }
    
    // Ensure directory exists
    const authDir = path.dirname(authFilePath);
    mkdirSync(authDir, { recursive: true });
    console.log(`📁 Auth directory created/verified: ${authDir}`);
    
    // Save storage state (cookies, localStorage, etc.)
    try {
      await context.storageState({ path: authFilePath });
      console.log(`✅ Authentication state saved successfully to: ${authFilePath}`);
      
      // Verify file was created and has content
      if (existsSync(authFilePath)) {
        const fileStats = statSync(authFilePath);
        const fileSize = fileStats.size;
        console.log(`✅ Auth file verified: ${authFilePath} exists (${fileSize} bytes)`);
        
        if (fileSize > 0) {
          console.log(`📝 You can now run other Weixin tests and they will use this saved session.`);
          console.log(`💡 Test with: pnpm upload:weixin-video`);
        } else {
          console.log(`⚠️  Warning: Auth file is empty!`);
          throw new Error('Auth file is empty');
        }
      } else {
        console.log(`❌ Error: Auth file was not created at ${authFilePath}`);
        throw new Error('Failed to create auth file');
      }
    } catch (saveError: any) {
      console.log(`❌ Error saving authentication state: ${saveError.message}`);
      console.log(`❌ Stack: ${saveError.stack}`);
      throw saveError;
    }
  } catch (e) {
    console.log('❌ Timeout: "昨日数据" text did not appear within 15 minutes.');
    console.log('⚠️  Please ensure you have completed the login process.');
    console.log('💡 You can run this script again: pnpm login:weixin-video');
    throw e;
  }
});
