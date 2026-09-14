const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const field = (name) => page.getByLabel(name, { exact: true });
    await page.goto('http://127.0.0.1:4173');
    await page.evaluate(() => {
      const at = '2026-09-14T12:00:00Z';
      const record = (id, text, createdAt = at) => ({
        id,
        text,
        category: '工作',
        createdAt,
        updatedAt: createdAt,
        starred: false,
        attachments: [],
        history: [],
      });
      localStorage.setItem(
        'zixu.preview.v1',
        JSON.stringify({
          version: 1,
          draft: '',
          memories: [
            record('work', '工作让我感到疲惫', '2020-01-01T12:00:00Z'),
            ...Array.from({ length: 2000 }, (_, n) => record('fruit' + n, '今天买了苹果 ' + n)),
          ],
          insights: [
            {
              id: 'stale',
              text: '不能进入请求的过时认识',
              category: '价值观',
              status: 'confirmed',
              origin: 'ai',
              sourceIds: ['work'],
              createdAt: at,
              sourceChanged: true,
              history: [],
            },
          ],
          composerDraft: {
            text: '上次未保存的文字',
            category: '学习',
            updatedAt: at,
            attachments: [
              {
                id: 'audio',
                kind: 'audio',
                uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
                name: 'audio.wav',
                mime: 'audio/wav',
                duration: 5000,
              },
            ],
          },
        }),
      );
    });
    await page.reload();
    await expect(button('记一条')).toBeVisible();
    // Both mounted record pages must window their rows, rather than render 4,002 views.
    const mounted = await page.locator('[aria-label^="打开记录："]').count();
    if (mounted > 100) throw Error('Large lists are not virtualized: ' + mounted);
    await button('记一条').click();
    await expect(field('记录内容')).toHaveValue('上次未保存的文字');
    await expect(button('播放录音')).toBeVisible();
    await field('记录内容').fill('关闭后还应恢复的文字');
    await button('返回').click();
    await page.reload();
    await button('记一条').click();
    await expect(field('记录内容')).toHaveValue('关闭后还应恢复的文字');
    await expect(button('播放录音')).toBeVisible();
    await button('返回').click();
    await button('设置').click();
    await field('API 地址（以 /v1 等服务商路径结尾）').fill('https://reliability.invalid/v1');
    await field('模型名称').fill('mock');
    await field('API Key').fill('fake-chat-key');
    await button('保存设置').click();
    await field('语音 API 地址').fill('https://speech.invalid/v1');
    await field('语音模型').fill('mock-speech');
    await field('语音 API Key').fill('fake-speech-key');
    await button('保存语音设置').click();
    await button('返回').click();
    let speechCalls = 0;
    await page.route('https://speech.invalid/v1/audio/transcriptions', async (route) => {
      speechCalls++;
      const raw = route.request().postDataBuffer().toString();
      if (!raw.includes('audio.wav') || !raw.includes('mock-speech'))
        throw Error('Missing selected audio/model');
      await route.fulfill({
        json: { text: '我喜欢旅行', segments: [{ start: 1, end: 3, text: '我喜欢旅行' }] },
      });
    });
    await button('记一条').click();
    await button('转写为文字').click();
    await expect(field('转写片段 1')).toHaveValue('我喜欢旅行');
    await field('转写片段 1').fill('我喜欢海边旅行');
    await expect(button('从 00:01 播放')).toBeVisible();
    await button('保存').click();
    await page.getByRole('tab', { name: '回忆', exact: true }).click();
    await field('搜索记忆').fill('海边旅行');
    await expect(page.getByText('原文搜索 · 1 条', { exact: true })).toBeVisible();
    await field('搜索记忆').fill('');
    let releaseResponse;
    const responseGate = new Promise(resolve => { releaseResponse = resolve; });
    let mode = 'normal',
      sent = [];
    await page.route('https://reliability.invalid/v1/chat/completions', async (route) => {
      const body = route.request().postDataJSON(),
        input = JSON.parse(body.messages[1].content);
      sent.push(input);
      if (JSON.stringify(input).includes('不能进入请求的过时认识'))
        throw Error('Stale profile leaked to model');
      if (mode === 'delay') {
        await responseGate;
        try {
          await route.fulfill({
            json: { choices: [{ message: { content: '不应出现的晚到回答 [1]' } }] },
          });
        } catch {}
        return;
      }
      await route.fulfill({
        json: {
          choices: [
            {
              message: {
                content: mode === 'uncited' ? '没有引用的经历推断' : '你记录过工作疲惫 [1]。',
              },
            },
          ],
        },
      });
    });
    await field('回忆问题').fill('我为什么不喜欢工作');
    await button('找找相关经历').click();
    await expect(page.getByText('你记录过工作疲惫 [1]。', { exact: true })).toBeVisible();
    if (sent[0].records.length !== 1) throw Error('Unrelated recent memories were sent');
    await page.getByRole('link', { name: '[1]', exact: true }).click();
    await expect(page.getByText('工作让我感到疲惫', { exact: true }).last()).toBeVisible();
    await button('返回').click();
    mode = 'uncited';
    await button('找找相关经历').click();
    await expect(
      page.getByText('回答没有提供原文引用，因此没有展示。请重试或缩小问题范围。', { exact: true }),
    ).toBeVisible();
    await button('知道了').click();
    mode = 'delay';
    await button('找找相关经历').click();
    await button('取消请求').click();
    await expect(page.getByText('已取消请求，记录仍在本机。', { exact: true })).toBeVisible();
    releaseResponse();
    await button('知道了').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('不应出现的晚到回答 [1]', { exact: true })).toHaveCount(0);
    await button('设置').click();
    const downloadEvent = page.waitForEvent('download');
    await button('仅导出文字').click();
    const raw = fs.readFileSync(await (await downloadEvent).path(), 'utf8');
    if (raw.includes('fake-chat-key') || raw.includes('fake-speech-key'))
      throw Error('Key leaked in backup');
    const pack = JSON.parse(raw);
    if (pack.library.memories.some((m) => m.attachments.length))
      throw Error('Text export contains media');
    if (!raw.includes('海边旅行')) throw Error('Text export dropped transcript');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')));
    pack.library.memories = [];
    pack.library.insights = [];
    const chooser = page.waitForEvent('filechooser');
    await button('恢复').click();
    await (
      await chooser
    ).setFiles({
      name: 'restore.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(pack)),
    });
    await page.getByText('恢复这份备份？', { exact: true }).waitFor();
    await page.getByRole('button', { name: '恢复', exact: true }).last().click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')).memories.length),
      )
      .toBe(0);
    await button('撤销上次恢复').click();
    await button('撤销恢复').click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('zixu.preview.v1')).memories.length),
      )
      .toBe(before.memories.length);
    if (speechCalls !== 1) throw Error('Unexpected speech upload');
    if (errors.length) throw Error(errors.join('\n'));
    fs.mkdirSync(path.resolve(__dirname, '../../artifacts/v0.6.0'), { recursive: true });
    await page.screenshot({
      path: path.resolve(__dirname, '../../artifacts/v0.6.0/reliability.png'),
    });
    console.log(
      'PASS: 2,001-record virtualization, complete draft reload, selected-audio transcription/correction/search, stale-profile exclusion, clickable citations, uncited-answer rejection, cancellation, text export and restore undo. No real provider called.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
