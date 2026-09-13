const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 try {
 const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
 await page.goto('http://127.0.0.1:4173');
 const at = '2026-09-13T00:00:00.000Z';
 const memories = ['a','b'].map(id => ({ id, text: '测试经历', category: '学习', createdAt: at, updatedAt: at, starred: false, attachments: [], history: [] }));
 const insights = ['pending','confirmed','rejected'].map(status => ({ id: status, text: `测试${status}`, category: '价值观', origin: 'ai', status, sourceIds: ['a','b'], createdAt: at, history: [] }));
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
 const after = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
 if (after.insights.length !== library.insights.length) throw Error('profile count changed');
 if (after.insights.filter(i => i.status === 'confirmed').length !== library.insights.filter(i => i.status === 'confirmed').length) throw Error('confirmed profile lost');
 console.log('PASS: profile loaded, rejected visible and recoverable, reload retains all profile rows (no private content logged)');
 } finally { await browser.close(); }
})().catch(() => { console.error('Profile regression failed'); process.exit(1); });
