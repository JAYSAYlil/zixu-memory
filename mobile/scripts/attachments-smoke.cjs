const { chromium, expect } = require('@playwright/test');
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 try {
 const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(() => {
  const at = new Date().toISOString();
  const photo = id => ({ id, kind: 'photo', uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', name: 'photo.png', mime: 'image/png' });
  localStorage.setItem('zixu.preview.v1', JSON.stringify({ version: 1, draft: '', insights: [], memories: [{ id: 'm', text: '附件编辑测试', category: '学习', createdAt: at, updatedAt: at, starred: false, history: [], attachments: [photo('p1'), photo('p2'), { id: 'a1', kind: 'audio', uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=', name: 'audio.wav', mime: 'audio/wav' }] }] }));
 });
 await page.reload();
 await page.getByRole('button', { name: /打开记录：附件编辑测试/ }).click();
 await page.getByRole('button', { name: '修改', exact: true }).click();
 await page.getByRole('button', { name: '移除照片 1', exact: true }).click();
 await page.getByRole('button', { name: '移除录音 1', exact: true }).click();
 await page.getByRole('button', { name: '返回', exact: true }).last().click();
 await page.getByRole('button', { name: '关闭', exact: true }).click();
 await page.getByRole('button', { name: '修改', exact: true }).click();
 await expect(page.getByRole('button', { name: '移除照片 2' })).toBeVisible();
 await expect(page.getByRole('button', { name: '移除录音 1' })).toBeVisible();
 await page.waitForTimeout(600);
 await page.screenshot({ path: '../artifacts/v0.4.1/attachments.png' });
 await page.getByRole('button', { name: '移除照片 1', exact: true }).click();
 await page.getByRole('button', { name: '移除录音 1', exact: true }).click();
 await page.getByRole('button', { name: '保存', exact: true }).click();
 const result = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
 if (result.memories[0].attachments.length !== 1 || result.memories[0].attachments[0].id !== 'p2') throw Error('removed attachments not persisted correctly');
 console.log('PASS: photo/audio removal, cancel preserves originals, save persists only retained attachments');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
