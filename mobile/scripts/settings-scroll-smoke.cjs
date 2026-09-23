const { completeWelcome } = require('./smoke-helpers.cjs');
const { chromium } = require('@playwright/test');

const url = 'http://127.0.0.1:4173';
const browserPath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function settingsScroll(page) {
  return page.getByText('数据与迁移', { exact: true }).evaluate((target) => {
    let node = target;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(style.overflowY)) {
        window.__settingsScrollNode = node;
        return { top: node.scrollTop, max: node.scrollHeight - node.clientHeight };
      }
      node = node.parentElement;
    }
    throw new Error('Settings ScrollView not found');
  });
}

async function setSettingsScroll(page, fraction) {
  return page.getByText('数据与迁移', { exact: true }).evaluate((target, amount) => {
    let node = target;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(style.overflowY)) {
        node.scrollTop = Math.round((node.scrollHeight - node.clientHeight) * amount);
        return { top: node.scrollTop, max: node.scrollHeight - node.clientHeight };
      }
      node = node.parentElement;
    }
    throw new Error('Settings ScrollView not found');
  }, fraction);
}

async function openSettings(page) {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByText('数据与迁移', { exact: true }).waitFor();
}

async function closeSettings(page, method) {
  if (method === 'escape') await page.keyboard.press('Escape');
  else await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByText('数据与迁移', { exact: true }).waitFor({ state: 'detached' });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.goto(url);
    await completeWelcome(page);
    await page.getByRole('button', { name: '记一条', exact: true }).waitFor();
    const failures = [];
    let expectedEntryOffset = 0;

    for (const scenario of [
      { theme: 'light', width: 393, height: 852, fraction: 0.42, close: 'back' },
      { theme: 'dark', width: 320, height: 640, fraction: 0.78, close: 'demo' },
      { theme: 'light', width: 393, height: 720, fraction: 0.61, close: 'back', focus: true },
      { theme: 'dark', width: 360, height: 760, fraction: 0.31, close: 'back' },
    ]) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.emulateMedia({ colorScheme: scenario.theme });
      try {
        await openSettings(page);
        const initial = await settingsScroll(page);
        const expectedEntry = Math.min(expectedEntryOffset, initial.max);
        if (Math.abs(initial.top - expectedEntry) > 3) {
          failures.push(`entry ${scenario.close}/${scenario.theme}: expected ${expectedEntry}, got ${initial.top}`);
        }
        const chosen = await setSettingsScroll(page, scenario.fraction);
        await page.waitForTimeout(80);
        if (scenario.close === 'back' && scenario.theme === 'light' && process.env.SETTINGS_SCROLL_SCREENSHOT) {
          await page.waitForTimeout(400);
          await page.screenshot({ path: process.env.SETTINGS_SCROLL_SCREENSHOT });
        }
        if (chosen.max < 120 || Math.abs(chosen.top - chosen.max * scenario.fraction) > 2) {
          throw new Error(`Could not establish exact settings scroll: ${JSON.stringify(chosen)}`);
        }
        if (scenario.focus) {
          const input = page.getByLabel('模型名称', { exact: true });
          await input.focus();
          await page.setViewportSize({ width: scenario.width, height: 440 });
        }
        let beforeClose;
        if (scenario.close === 'demo') {
          const browse = page.getByRole('button', { name: '浏览示例内容', exact: true });
          await browse.scrollIntoViewIfNeeded();
          await page.waitForTimeout(80);
          beforeClose = await settingsScroll(page);
          await browse.evaluate((button) => button.click());
          await page.getByText('数据与迁移', { exact: true }).waitFor({ state: 'detached' });
          expectedEntryOffset = beforeClose.top;
        } else {
          beforeClose = await settingsScroll(page);
          expectedEntryOffset = beforeClose.top;
          await closeSettings(page, scenario.close);
        }
        await openSettings(page);
        const reopened = await settingsScroll(page);
        const expectedReopened = Math.min(beforeClose.top, reopened.max);
        if (Math.abs(reopened.top - expectedReopened) > 3) {
          failures.push(`${scenario.close}/${scenario.theme}: ${beforeClose.top} -> ${reopened.top} (clamped target ${expectedReopened})`);
        }
        if (scenario.focus) {
          const focusedInput = await page.evaluate(() =>
            document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA',
          );
          if (focusedInput) failures.push('reopened settings unexpectedly retained input focus');
        }
        if (scenario.close === 'demo') {
          const exitDemo = page.getByRole('button', { name: '退出示例', exact: true });
          await exitDemo.scrollIntoViewIfNeeded();
          await page.waitForTimeout(80);
          expectedEntryOffset = (await settingsScroll(page)).top;
          await exitDemo.evaluate((button) => button.click());
          await page.getByText('数据与迁移', { exact: true }).waitFor({ state: 'detached' });
        } else {
          await closeSettings(page, 'back');
        }
      } catch (error) {
        failures.push(`${scenario.close}/${scenario.theme}: ${error.message}`);
        if (await page.getByText('数据与迁移', { exact: true }).count()) {
          await page.getByRole('button', { name: '返回', exact: true }).click().catch(() => {});
        }
      }
    }

    if (failures.length) throw new Error(failures.join('; '));
    console.log('PASS: settings scroll retained over repeated reopen, exit methods, themes, viewport changes and focused input.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`Settings scroll regression: ${error.message}`);
  process.exit(1);
});
