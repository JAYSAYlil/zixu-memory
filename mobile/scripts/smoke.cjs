const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: '记一条', exact: true }).waitFor();
  await page.getByRole('button', { name: '先看看示例' }).click();
  await page.getByText('示例内容 · 不属于你的记忆').waitFor();
  const folder = path.resolve(__dirname, '../../artifacts');
  fs.mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: path.join(folder, '01-records.png') });
  await page.getByRole('tab', { name: '认识我', exact: true }).click();
  await page.getByRole('button', { name: '符合我', exact: true }).waitFor();
  await page.screenshot({ path: path.join(folder, '02-profile.png') });
  await page.getByRole('button', { name: '符合我', exact: true }).click();
  await page.getByRole('tab', { name: '回忆', exact: true }).click();
  await page.screenshot({ path: path.join(folder, '03-recall.png') });
  await page.getByText('退出 ×').click();
  await page.getByRole('tab', { name: '记录', exact: true }).click();
  await page.getByText('0 条记录', { exact: true }).waitFor();
  await page.getByRole('button', { name: '记一条', exact: true }).click();
  await page
    .getByLabel('记录内容', { exact: true })
    .fill('今天做了自己的第二记忆，想把生活里的小事留下来。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('1 条记录', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('1 条记录', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '回忆', exact: true }).click();
  await page.getByLabel('搜索记忆').fill('小事');
  await page.getByText('原文搜索 · 1 条').waitFor();
  await page.getByRole('button', { name: /打开记录：今天做了/ }).click();
  await page.getByRole('button', { name: '修改', exact: true }).click();
  await page.getByLabel('记录内容').fill('后来发现，重要的是能按自己的节奏生活。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '返回', exact: true }).last().click();
  await page.getByLabel('搜索记忆').fill('节奏');
  await page.getByRole('button', { name: /打开记录：后来发现/ }).click();
  await page.getByText('修改前的文字').waitFor();
  await page.getByRole('button', { name: '返回', exact: true }).last().click();
  await page.getByRole('tab', { name: '认识我', exact: true }).click();
  await page.getByRole('button', { name: '补充自我认识' }).click();
  await page.getByLabel('自我认识', { exact: true }).fill('我重视自主安排时间。');
  await page.getByRole('button', { name: '保存并确认' }).click();
  await page.getByText('我重视自主安排时间。', { exact: true }).first().waitFor();
  await page.reload();
  await page.getByRole('tab', { name: '认识我', exact: true }).click();
  await page.getByText('我重视自主安排时间。', { exact: true }).first().waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
  if (
    saved.memories.length !== 1 ||
    saved.insights.length !== 1 ||
    saved.memories[0].history.length !== 1
  )
    throw Error('Persistence mismatch');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: isolated demo, create, reload persistence, Chinese search, revision history, profile create and persistence.',
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
