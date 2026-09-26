import { expect, test, type Page } from '@playwright/test';

const tap = async (page: Page, ...keys: string[]) => {
  for (const k of keys) {
    await page.locator(`button[data-key="${k}"]`).dispatchEvent('pointerdown');
  }
};
const value = (page: Page) => page.getByTestId('value');
const label = (page: Page) => page.getByTestId('label');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('value')).toHaveText('0.00');
  // listeners attach in an effect after first paint
  await page.waitForFunction(() => document.querySelector('.keypad') !== null);
  await page.waitForTimeout(50);
});

test('starts at 0.00 and does Chn arithmetic from the keypad', async ({ page }) => {
  await expect(value(page)).toHaveText('0.00');
  await tap(page, 'D3', 'ADD', 'D2', 'MUL', 'D4', 'EQ');
  await expect(value(page)).toHaveText('20.00');
});

test('keyboard shortcuts, including Shift as 2ND', async ({ page }) => {
  await page.keyboard.type('52');
  await page.keyboard.press('Shift');
  await page.keyboard.press('/'); // 2ND ÷ = nCr
  await page.keyboard.type('5');
  await page.keyboard.press('Enter');
  await expect(value(page)).toHaveText('2,598,960.00');
  await page.keyboard.press('Escape');
  await expect(value(page)).toHaveText('0.00');
});

test('2ND arms, tints labels, and shows the 2nd indicator', async ({ page }) => {
  await tap(page, '2ND');
  await expect(page.locator('.keypad')).toHaveClass(/armed/);
  await expect(page.locator('[data-ind="second"]')).toHaveClass(/on/);
  await tap(page, '2ND');
  await expect(page.locator('.keypad')).not.toHaveClass(/armed/);
});

test('TVM payment flow through the worker', async ({ page }) => {
  await tap(page, '2ND', 'IY', 'D1', 'D2', 'ENTER', '2ND', 'CPT');
  await tap(page, 'D3', 'D6', 'D0', 'N', 'D5', 'DOT', 'D5', 'IY');
  await tap(page, 'D7', 'D5', 'D0', 'D0', 'D0', 'PV', 'D0', 'FV', 'CPT', 'PMT');
  await expect(label(page)).toHaveText('PMT=');
  await expect(value(page)).toHaveText('-425.84');
});

test('reload restores the exact state, including pending math', async ({ page }) => {
  await tap(page, 'D7', 'STO', 'D1', 'D3', 'ADD', 'D4');
  await expect(value(page)).toHaveText('4');
  await page.reload();
  await expect(value(page)).toHaveText('4');
  await tap(page, 'EQ');
  await expect(value(page)).toHaveText('7.00');
  await tap(page, 'RCL', 'D1');
  await expect(value(page)).toHaveText('7.00');
});

test('errors show and clear with CE|C', async ({ page }) => {
  await tap(page, 'D1', 'DIV', 'D0', 'EQ');
  await expect(value(page)).toHaveText('Error 1');
  await tap(page, 'CEC');
  await expect(value(page)).toHaveText('0.00');
});

test('cheat sheet opens on ?', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('keystroke log is off by default and can replay a script', async ({ page }) => {
  await expect(page.getByTestId('log')).toHaveCount(0);
  await page.getByRole('button', { name: 'Keystroke log' }).click();
  await page.locator('.log textarea').fill('PROFIT 100 ENTER ↓ 125 ENTER ↓ CPT');
  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(label(page)).toHaveText('MAR=');
  await expect(value(page)).toHaveText('20.00');
});

test('keys are at least 44px tall', async ({ page }) => {
  const heights = await page.locator('button.key').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
});

test('no horizontal scroll', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
