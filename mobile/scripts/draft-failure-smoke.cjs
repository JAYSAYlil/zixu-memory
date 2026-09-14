const { chromium, expect } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto('http://127.0.0.1:4173');
    await button('记一条').click();
    await page.evaluate(() => {
      window.__originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'zixu.preview.v1') throw new DOMException('模拟磁盘已满', 'QuotaExceededError');
        return window.__originalSetItem.call(this, key, value);
      };
    });
    await page.getByLabel('记录内容', { exact: true }).fill('保存失败也不能丢失的草稿');
    await expect(page.getByText('草稿保存失败，请保持页面打开并重试', { exact: true })).toBeVisible();
    await button('保存').click();
    await expect(page.getByText('模拟磁盘已满', { exact: true })).toBeVisible();
    await button('知道了').click();
    await expect(page.getByLabel('记录内容', { exact: true })).toHaveValue('保存失败也不能丢失的草稿');
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
    await button('保存').click();
    await expect(page.getByLabel('记录内容', { exact: true })).toBeHidden();
    await button('记一条').click(); await button('返回').click();
    await page.getByRole('button', { name: '打开记录：保存失败也不能丢失的草稿', exact: true }).click();
    await button('修改').click();
    await expect(page.getByLabel('记录内容', { exact: true })).toBeVisible();
    await page.getByLabel('记录内容', { exact: true }).fill('保留为编辑草稿');
    await button('返回').last().click();
    await expect(page.getByLabel('记录内容', { exact: true })).toBeHidden();
    await expect(button('修改')).toBeVisible();
    await button('返回').last().click();
    await page.reload(); await button('记一条').click();
    await expect(page.getByLabel('记录内容', { exact: true })).toHaveValue('保留为编辑草稿');
    await button('放弃草稿').click(); await button('放弃草稿').last().click();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
    if (state.composerDraft || state.memories[0].text !== '保存失败也不能丢失的草稿') throw Error('Discard changed original memory');
    console.log('PASS: draft/save storage failure preserves editor, retry succeeds, empty draft does not block editing, edit draft survives reload and explicit discard preserves original.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
