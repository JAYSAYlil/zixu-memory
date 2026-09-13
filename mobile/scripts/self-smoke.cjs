const { chromium, expect } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.goto('http://127.0.0.1:4173');
    await page.getByRole('button', { name: '记一条', exact: true }).click();
    await page.getByLabel('记录内容').fill('学习时我喜欢自己安排节奏');
    await page.getByText('学习', { exact: true }).last().click();
    await expect(page.getByRole('button', { name: '拍照', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('button', { name: /打开记录：学习时/ }).click();
    await page.getByRole('button', { name: '修改', exact: true }).click();
    await expect(page.getByRole('button', { name: '添加照片', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '开始录音', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '拍照', exact: true })).toBeVisible();
    await page.getByText('想法', { exact: true }).last().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
    if (saved.memories[0].category !== '想法') throw Error('category not persisted');
    await page.getByRole('button', { name: '返回', exact: true }).last().click();
    await page.getByRole('tab', { name: '认识我' }).click();
    await page.getByRole('button', { name: '补充自我认识' }).click();
    await page.getByLabel('自我认识', { exact: true }).fill('我重视自主，也愿意听取具体的建议。');
    await page.getByRole('button', { name: '保存并确认' }).click();
    await page.getByRole('button', { name: '导出我的价值观', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '保存或分享 SKILL.md' }).click();
    if ((await download).suggestedFilename() !== 'SKILL.md') throw Error('export failed');
    await page.getByRole('button', { name: '返回', exact: true }).last().click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByLabel('API Key', { exact: true }).fill('test-only');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByRole('button', { name: '返回', exact: true }).last().click();
    await page.route('https://api.deepseek.com/**', async route => {
      const body = route.request().postDataJSON();
      const input = JSON.parse(body.messages[1].content);
      if (!input.confirmedProfile.some(i => i.text.includes('我重视自主'))) throw Error('missing self profile');
      await route.fulfill({ json: { choices: [{ message: { content: '我可能更愿意保留自主安排的空间。' } }] } });
    });
    await expect(page.getByLabel('API Key', { exact: true })).toBeHidden();
    await page.getByLabel('询问自己的问题').fill('我会怎么安排学习？');
    await page.getByRole('button', { name: '听听自己的答案' }).click();
    await expect(page.getByText('我可能更愿意保留自主安排的空间。', { exact: true })).toBeVisible();
    await page.screenshot({ path: '../artifacts/v0.4.0/self.png', fullPage: true });
    console.log('PASS: learning tag, edit controls and category persistence, SKILL.md export, self question with mocked provider');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
