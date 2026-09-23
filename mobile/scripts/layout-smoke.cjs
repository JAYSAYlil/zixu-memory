const { chromium, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const out = path.resolve(__dirname, '../../artifacts/v0.6.1');
  fs.mkdirSync(out, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const button = name => page.getByRole('button', { name, exact: true });
    const shot = async name => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, name + '.png') }); };
    const tab = async name => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(350); };
    await page.goto('http://127.0.0.1:4173');
    await page.getByRole('button', {name:'开始记录',exact:true}).click();
    await page.evaluate(() => localStorage.setItem('zixu.preview.v1', JSON.stringify({ version: 1, draft: '', insights: [], memories: [
      ['leap', '散步时想到，下次可以多留一点时间给自己。', '2024-02-29T12:00:00Z', '日常'],
      ['march', '把工作安排在上午，下午留给想做的事。', '2024-03-01T12:00:00Z', '工作'],
      ['old', '去年的旅行', '2023-02-28T12:00:00Z', '日常'],
    ].map(([id, text, createdAt, category]) => ({ id, text, createdAt, updatedAt: createdAt, category, starred: false, attachments: [], history: [] })) })));
    await page.reload();
    await button('记一条').waitFor();
    await shot('records');
    await tab('回忆');
    await button('设置时间与分类范围').click();
    await expect(page.getByRole('textbox', { name: /开始日期|结束日期/ })).toHaveCount(0);
    await expect(button('开始日期')).toBeVisible();
    async function pick(field, target) {
      await button(field).click();
      await button('选择年份').click();
      await button(`选择 ${target.slice(0,4)} 年`).click();
      // The month starts at the currently selected date, or the current month.
      const targetMonth = Number(target.slice(5,7));
      for (let n = 0; n < 12; n++) {
        const title = await button('选择年份').innerText();
        const current = Number(title.match(/年\s*(\d+)\s*月/)[1]);
        if (current === targetMonth) break;
        await button(current > targetMonth ? '上个月' : '下个月').click();
      }
      await button(`选择日期 ${target}`).click();
    }
    await pick('开始日期', '2024-02-29');
    await pick('结束日期', '2024-02-28');
    await expect(button('应用范围')).toBeDisabled();
    await expect(page.getByText('结束日期早于开始日期，请重新选择。')).toBeVisible();
    await pick('结束日期', '2024-03-01');
    await expect(page.getByText('当前范围内有 2 条记录。')).toBeVisible();
    await button('应用范围').click();
    await expect(button('设置时间与分类范围')).toContainText('2024-02-29 至 2024-03-01');
    await page.getByLabel('搜索记忆', { exact: true }).fill('去年');
    await expect(page.getByText('原文搜索 · 0 条')).toBeVisible();
    await page.getByLabel('搜索记忆', { exact: true }).fill('时间');
    await expect(page.getByText('原文搜索 · 1 条')).toBeVisible();
    await button('设置时间与分类范围').click();
    await button('不限时间').click();
    await button('返回').click();
    await expect(button('设置时间与分类范围')).toContainText('2024-02-29 至 2024-03-01');
    await button('设置时间与分类范围').click();
    await button('不限时间').click();
    await button('应用范围').click();
    await page.getByLabel('搜索记忆', { exact: true }).fill('');
    await shot('recall');
    await tab('认识我');
    await shot('profile');
    await button('选择观察范围与经历').click();
    await button('工作').click();
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await page.getByRole('checkbox').click();
    await button('应用范围').click();
    await expect(button('选择观察范围与经历')).toContainText('已选 1 条');
    await button('选择观察范围与经历').click();
    await button('日常').click();
    await button('应用范围').click();
    await expect(page.getByRole('alert')).toContainText('勾选的经历不在当前范围里');
    await button('清空选择与范围').click();
    await button('应用范围').click();
    // Narrow and landscape-like short viewports: primary controls must remain reachable.
    for (const [width, height, theme] of [[320,640,'light'], [393,852,'dark'], [620,480,'light']]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      await page.reload();
      await button('记一条').waitFor();
      await tab('认识我');
      await button('选择观察范围与经历').click();
      await button('开始日期').click();
      await shot(`calendar-${width}-${theme}`);
      const box = await button('不限开始日期').boundingBox();
      if (!box || box.y < 0 || box.y + box.height > height + 1) throw Error('Range footer clipped');
      await button('返回').click();
      await button('返回').click();
      await tab('记录');
      await button('记一条').click();
      await page.getByLabel('记录内容', { exact: true }).fill('长记录也能随时保存。\n'.repeat(60));
      await shot(`composer-${width}-${theme}`);
      const saveBox = await button('保存').boundingBox();
      if (!saveBox || saveBox.y + saveBox.height > height + 1) { await shot('composer-failure'); throw Error('Composer footer clipped ' + JSON.stringify({ width, height, saveBox })); }
      await button('返回').click();
      await button('设置').click();
      await shot(`settings-${width}-${theme}`);
      // Walk every settings action and assert horizontal containment after scrolling into view.
      for (const name of ['保存设置','保存语音设置','导出完整备份','仅导出文字','选择备份并恢复','撤销上次恢复']) {
        await button(name).scrollIntoViewIfNeeded();
        const rect = await button(name).boundingBox();
        if (rect.x < 0 || rect.x + rect.width > width + 1) throw Error(`${name} overflows ${width}`);
      }
      await button('返回').click();
      await tab('认识我');
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log('PASS: calendar leap day, year/month navigation, reversed dates, transactional cancel/apply, scoped search, observation selection, 320/393/620 layouts, dark mode, pinned actions, long editor, settings controls.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
