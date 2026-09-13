const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  let calls = 0;
  await page.route('https://memory-test.invalid/v1/chat/completions', async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    const input = JSON.parse(body.messages[1].content);
    const content = Array.isArray(input.userFeedback)
      ? JSON.stringify([
          {
            text: '这两次经历中，你似乎在意自己安排时间。',
            category: '在意的事',
            sourceIds: input.records.map((m) => m.id),
          },
        ])
      : '你提到过自己安排工作的节奏 [1]。这只是当前记录中的线索。';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }] }),
    });
  });
  await page.goto('http://127.0.0.1:4173');
  for (const text of ['自己安排工作时感觉轻松。', '今天有一段自己的时间，很舒服。']) {
    await page.getByRole('button', { name: '记一条', exact: true }).click();
    await page.getByLabel('记录内容', { exact: true }).fill(text);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByLabel('记录内容', { exact: true }).waitFor({ state: 'hidden' });
  }
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page
    .getByLabel('API 地址（以 /v1 等服务商路径结尾）', { exact: true })
    .fill('https://memory-test.invalid/v1');
  await page.getByLabel('模型名称', { exact: true }).fill('test-model');
  await page.getByLabel('API Key', { exact: true }).fill('test-key-not-real');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: '认识我', exact: true }).click();
  await page.getByRole('button', { name: '从经历里整理观察' }).click();
  await page.getByText('这两次经历中，你似乎在意自己安排时间。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '有些不同', exact: true }).click();
  await page
    .getByLabel('自我认识', { exact: true })
    .fill('我喜欢自己安排时间，但也能接受事先约好的计划。');
  await page.getByRole('button', { name: '保存并确认' }).click();
  await page.getByLabel('自我认识', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: '回忆', exact: true }).click();
  await page.getByLabel('回忆问题').fill('什么让我轻松？');
  await page.getByRole('button', { name: '找找相关经历' }).click();
  await page
    .getByText('你提到过自己安排工作的节奏 [1]。这只是当前记录中的线索。', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.includes('test-key-not-real')) throw Error('Key leaked into backup');
  const pack = JSON.parse(raw);
  if (pack.library.insights[0].history.length !== 1) throw Error('Correction history lost');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: /打开记录：自己安排工作/ }).click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByText('删除这条记录？', { exact: true }).waitFor();
  await page.getByRole('button', { name: '删除', exact: true }).last().click();
  await page.getByRole('button', { name: '删除', exact: true }).waitFor({ state: 'hidden' });
  const afterDelete = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('zixu.preview.v1')),
  );
  // 设计行为（见 core.test.ts 与 ARCHITECTURE.md）：删除来源后观察保留，
  // 但必须标记 sourceChanged 表示依据已失效，而不是直接清空。
  if (
    afterDelete.insights.length !== 1 ||
    afterDelete.insights[0].sourceChanged !== true ||
    afterDelete.memories.length !== 1
  )
    throw Error('Derived data not invalidated');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '恢复', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await page.getByText('恢复这份备份？', { exact: true }).waitFor();
  await page.getByRole('button', { name: '恢复', exact: true }).last().click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('zixu.preview.v1')).memories.length === 2,
  );
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
  if (restored.insights[0].status !== 'confirmed') throw Error('Profile not restored');
  if (calls !== 2) throw Error('Unexpected AI calls');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: mocked BYOK, evidence-backed observations, user correction, recall, key-free export, deletion invalidation, backup restore. No real provider called.',
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
