const { completeWelcome } = require('./smoke-helpers.cjs');
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 try {
 const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
 await page.goto('http://127.0.0.1:4173');
 await completeWelcome(page);
 const at = '2026-09-13T00:00:00.000Z';
 const memories = ['a','b','c'].map((id, index) => ({ id, text: index === 1 ? '一条很长的虚构反例记录，用来确认窄屏中的摘要会限制行数而不会撑开整张卡片。'.repeat(5) : `虚构反例经历${id}`, category: '学习', createdAt: at, updatedAt: at, starred: false, attachments: [], history: [] }));
 const insights = ['pending','confirmed','rejected'].map(status => ({ id: status, text: `测试${status}`, category: '价值观', origin: 'ai', status, sourceIds: ['a','b'], ...(status === 'confirmed' ? { counterSourceIds: ['b','c'] } : {}), createdAt: at, history: [] }));
 const library = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).library : { version: 1, memories, insights, draft: '' };
 await page.evaluate(data => localStorage.setItem('zixu.preview.v1', JSON.stringify(data)), library);
 await page.reload();
 await page.getByRole('tab', { name: '认识我', exact: true }).click();
 await page.getByRole('button', { name: /已搁置的认识/ }).click();
 await expect(page.getByRole('button', { name: '重新考虑', exact: true }).first()).toBeVisible();
 await page.getByRole('button', { name: '重新考虑', exact: true }).first().click();
 await page.reload();
 await page.getByRole('tab', { name: '认识我', exact: true }).click();
 await expect(page.getByRole('button', { name: '符合我', exact: true }).first()).toBeVisible();
 await page.setViewportSize({ width: 320, height: 640 });
 const counterexamples = page.getByRole('button').filter({ hasText: '↳ 反例 ·' });
 await expect(counterexamples).toHaveCount(2);
 await counterexamples.first().scrollIntoViewIfNeeded();
 if (process.env.VALUES_PREVIEW_SCREENSHOT) await page.screenshot({ path: process.env.VALUES_PREVIEW_SCREENSHOT });
 if (process.env.VALUES_PREVIEW_SCREENSHOT_393) {
   await page.setViewportSize({ width: 393, height: 852 });
   await page.screenshot({ path: process.env.VALUES_PREVIEW_SCREENSHOT_393 });
   await page.setViewportSize({ width: 320, height: 640 });
 }
 await expect(counterexamples.first()).toContainText('很长的虚构反例记录');
 await expect(counterexamples.nth(1)).toContainText('虚构反例经历c');
 const previewLabels = await counterexamples.allTextContents();
 if (previewLabels.some(label => /查看反例\s+[bc]/.test(label))) throw Error('counterexample row exposes an internal id');
 const firstBox = await counterexamples.nth(0).boundingBox();
 const secondBox = await counterexamples.nth(1).boundingBox();
 if (!firstBox || !secondBox || secondBox.y - (firstBox.y + firstBox.height) < 3) throw Error('counterexample rows have no visible spacing');
 await counterexamples.first().click();
 await expect(page.getByText(/很长的虚构反例记录/).last()).toBeVisible();
 await page.getByRole('button', { name: '返回', exact: true }).click();
 await page.getByRole('tab', { name: '认识我', exact: true }).click();
 const after = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
 if (after.insights.length !== library.insights.length) throw Error('profile count changed');
 if (after.insights.filter(i => i.status === 'confirmed').length !== library.insights.filter(i => i.status === 'confirmed').length) throw Error('confirmed profile lost');
 console.log('PASS: profile loaded, rejected visible and recoverable, reload retains all profile rows (no private content logged)');
 } finally { await browser.close(); }
})().catch((error) => { console.error(`Profile regression failed: ${error.message}`); process.exit(1); });
