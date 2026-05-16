import { Page, BrowserContext } from '@playwright/test';
import path from 'path';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

export interface LoginConfig {
  platform: string;
  loginUrl: string;
  loginIndicators: string[];
  notLoggedInIndicators?: string[]; // Indicators that show user is NOT logged in
  authFilePath: string;
}

/**
 * Generic login helper function that supports infinite wait for user input
 * 
 * @param page - Playwright page object
 * @param context - Playwright browser context
 * @param config - Login configuration
 */
export async function performLogin(
  page: Page,
  context: BrowserContext,
  config: LoginConfig
): Promise<void> {
  // IMPORTANT: Delete old auth file at the start to force fresh login
  // This ensures we always check the actual login status, not rely on old files
  if (existsSync(config.authFilePath)) {
    console.log(`🗑️  Deleting old authentication file: ${config.authFilePath}`);
    try {
      unlinkSync(config.authFilePath);
      console.log('✅ Old authentication file deleted successfully');
    } catch (error) {
      console.log(`⚠️  Warning: Could not delete old auth file: ${error}`);
    }
  }
  
  // Set page-level timeout to 10 minutes
  page.setDefaultTimeout(10 * 60 * 1000);
  
  console.log(`🌐 Opening ${config.platform}...`);
  await page.goto(config.loginUrl, { 
    waitUntil: 'domcontentloaded',
    timeout: 10 * 60 * 1000 // 10 minutes timeout for page load
  });

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded', { timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(2000); // Wait for dynamic content
  
  // Automatic login detection - no need to click Resume
  console.log(`🔐 Please login to ${config.platform} manually in the browser...`);
  console.log('🗑️  Old authentication file has been deleted - you need to login again');
  console.log('💡 You can take your time - the script will automatically detect when you are logged in');
  console.log('🔄 The script will check every 5 seconds for login status');
  console.log('📝 The script will also check every minute if the auth file has been created');
  console.log('⏰ Maximum wait time: 15 minutes');
  console.log('');
  
  const maxWaitTime = 15 * 60 * 1000; // 15 minutes maximum wait
  const pageCheckInterval = 5000; // Check page every 5 seconds
  const fileCheckInterval = 60 * 1000; // Check file every 1 minute
  const startTime = Date.now();
  let verified = false;
  let lastFileCheckTime = Date.now();
  let checkCount = 0;
  
  console.log('⏳ Waiting for login... (you can freely use the browser)');
  
  // Continuous loop to check login status
  while (!verified && (Date.now() - startTime) < maxWaitTime) {
    checkCount++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.floor((maxWaitTime - (Date.now() - startTime)) / 1000);
    
    // Check authentication file first (every minute)
    if (Date.now() - lastFileCheckTime >= fileCheckInterval) {
      if (existsSync(config.authFilePath)) {
        console.log(`✅ Authentication file detected: ${config.authFilePath}`);
        console.log('📝 Auth file was created - you may have saved the session manually');
        verified = true;
        break;
      }
      lastFileCheckTime = Date.now();
    }
    
    // Check page login status (every 5 seconds)
    // First check if NOT logged in, then check if logged in
    if (!verified) {
      let isNotLoggedIn = false;
      
      // Check for "not logged in" indicators first
      if (config.notLoggedInIndicators && config.notLoggedInIndicators.length > 0) {
        for (const selector of config.notLoggedInIndicators) {
          try {
            const indicator = page.locator(selector).first();
            const visible = await indicator.isVisible({ timeout: 2000 });
            if (visible) {
              isNotLoggedIn = true;
              break;
            }
          } catch (e) {
            // Continue checking
          }
        }
      }
      
      // Only check for login indicators if we don't see "not logged in" indicators
      if (!isNotLoggedIn) {
        for (const selector of config.loginIndicators) {
          try {
            const indicator = page.locator(selector).first();
            const visible = await indicator.isVisible({ timeout: 3000 });
            if (visible) {
              // Double check: make sure we don't see "not logged in" indicators
              if (config.notLoggedInIndicators && config.notLoggedInIndicators.length > 0) {
                let stillNotLoggedIn = false;
                for (const notLoggedInSelector of config.notLoggedInIndicators) {
                  try {
                    const notLoggedInIndicator = page.locator(notLoggedInSelector).first();
                    if (await notLoggedInIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
                      stillNotLoggedIn = true;
                      break;
                    }
                  } catch (e) {
                    // Continue
                  }
                }
                if (!stillNotLoggedIn) {
                  verified = true;
                  console.log(`✅ Login detected for ${config.platform}!`);
                  break;
                }
              } else {
                // No "not logged in" indicators configured, trust the login indicator
                verified = true;
                console.log(`✅ Login detected for ${config.platform}!`);
                break;
              }
            }
          } catch (e) {
            // Continue checking other indicators
          }
        }
      }
    }
    
    // If still not verified, wait and show progress
    if (!verified) {
      // Show progress every 30 seconds
      if (checkCount % 6 === 0) {
        console.log(`⏳ Still waiting... (${elapsed}s elapsed, ${remaining}s remaining)`);
      }
      await page.waitForTimeout(pageCheckInterval);
    }
  }
  
  // Final verification
  if (!verified) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`⚠️  Login not detected after ${elapsed} seconds.`);
    console.log('🔍 Performing final check...');
    
    // Final check for auth file
    if (existsSync(config.authFilePath)) {
      console.log('✅ Authentication file found in final check!');
      verified = true;
    }
    
    // Final check for page indicators
    if (!verified) {
      await page.waitForTimeout(2000);
      
      // Check for "not logged in" indicators first
      let isNotLoggedIn = false;
      if (config.notLoggedInIndicators && config.notLoggedInIndicators.length > 0) {
        for (const selector of config.notLoggedInIndicators) {
          try {
            const indicator = page.locator(selector).first();
            const visible = await indicator.isVisible({ timeout: 3000 });
            if (visible) {
              isNotLoggedIn = true;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }
      
      // Only check login indicators if not logged in indicators are not present
      if (!isNotLoggedIn) {
        for (const selector of config.loginIndicators) {
          try {
            const indicator = page.locator(selector).first();
            const visible = await indicator.isVisible({ timeout: 5000 });
            if (visible) {
              // Double check: make sure we don't see "not logged in" indicators
              if (config.notLoggedInIndicators && config.notLoggedInIndicators.length > 0) {
                let stillNotLoggedIn = false;
                for (const notLoggedInSelector of config.notLoggedInIndicators) {
                  try {
                    const notLoggedInIndicator = page.locator(notLoggedInSelector).first();
                    if (await notLoggedInIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
                      stillNotLoggedIn = true;
                      break;
                    }
                  } catch (e) {
                    // Continue
                  }
                }
                if (!stillNotLoggedIn) {
                  verified = true;
                  console.log(`✅ Login verified for ${config.platform} in final check!`);
                  break;
                }
              } else {
                verified = true;
                console.log(`✅ Login verified for ${config.platform} in final check!`);
                break;
              }
            }
          } catch (e) {
            // Continue
          }
        }
      }
    }
    
    if (!verified) {
      console.log('⚠️  Warning: Login verification failed after maximum wait time.');
      console.log('💡 You can:');
      console.log('   1. Run the login script again');
      console.log('   2. Manually create the auth file if you have saved the session');
      console.log('   3. Check if the login indicators are correct');
    }
  }
  
  // Only save authentication state if we verified login successfully
  if (verified) {
    console.log('💾 Saving authentication state...');
    
    // Ensure directory exists
    const authDir = path.dirname(config.authFilePath);
    mkdirSync(authDir, { recursive: true });
    
    // Save storage state (cookies, localStorage, etc.)
    await context.storageState({ path: config.authFilePath });
    
    console.log(`✅ Authentication state saved to: ${config.authFilePath}`);
    console.log(`📝 You can now run other ${config.platform} tests and they will use this saved session.`);
  } else {
    console.log('❌ Login verification failed - authentication state NOT saved');
    console.log('💡 Please run the login script again and ensure you complete the login process');
  }
}

/**
 * Get auth file path for a platform
 */
export function getAuthFilePath(platform: string): string {
  return path.join(__dirname, '../../playwright/.auth', `${platform}.json`);
}
