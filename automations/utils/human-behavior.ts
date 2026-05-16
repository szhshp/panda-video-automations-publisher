import type { Locator, Page } from '@playwright/test';

/** Integer in [min, max] inclusive */
export function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Random idle pause; avoids perfectly regular automation timing */
export async function humanDelay(page: Page, minMs: number, maxMs: number): Promise<void> {
  await page.waitForTimeout(randomBetween(minMs, maxMs));
}

/**
 * Reduce obvious bot patterns: scroll into view, move mouse with steps, then click with press duration.
 */
export async function humanClick(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await humanDelay(page, 120, 420);
  const box = await locator.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.25 + Math.random() * 0.5);
    const y = box.y + box.height * (0.25 + Math.random() * 0.5);
    await page.mouse.move(x, y, { steps: randomBetween(6, 14) });
    await humanDelay(page, 60, 200);
  }
  await locator.click({ delay: randomBetween(40, 140) });
}

/**
 * Clear a focused contenteditable / text field and type like a human (per-character delay).
 * Prefer this over locator.fill() for rich-text UIs that track input events.
 */
export async function humanFillEditable(page: Page, locator: Locator, text: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await humanDelay(page, 180, 480);
  await locator.click({ delay: randomBetween(35, 120) });
  await humanDelay(page, 100, 320);
  if (process.platform === 'darwin') {
    await page.keyboard.press('Meta+A');
  } else {
    await page.keyboard.press('Control+A');
  }
  await humanDelay(page, 40, 140);
  await page.keyboard.press('Backspace');
  await humanDelay(page, 160, 420);
  if (text.length > 0) {
    await locator.pressSequentially(text, { delay: randomBetween(28, 92) });
  }
  await humanDelay(page, 120, 360);
}

/**
 * Light fingerprint tweaks before first navigation. Not a silver bullet; pairs with human-like actions.
 */
export async function patchNavigatorForPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
}
