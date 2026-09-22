const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://127.0.0.1:4173';
const OUT = path.resolve(__dirname, '../../artifacts/theme-accent');
const rgb = (hex) => {
  const v = hex.replace('#', '');
  return `rgb(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)})`;
};

// 每套主题色在浅深两端的强调色，与 src/palette.ts 一致；网页预览用于验证实际下发到样式的值。
const LIGHT = {
  teal: '#087F73',
  blue: '#1565C0',
  indigo: '#3F51B5',
  violet: '#7A4FBF',
  pink: '#C2185B',
  orange: '#BB5800',
  green: '#2E7D32',
  graphite: '#455A64',
};
const DARK = {
  teal: '#3ADBC4',
  blue: '#8AB4F8',
  indigo: '#A6B4FF',
  violet: '#CFA9F5',
  pink: '#FFA8C4',
  orange: '#FFB870',
  green: '#87D68C',
  graphite: '#A8C0CC',
};
const NAMES = {
  teal: '青绿',
  blue: '海蓝',
  indigo: '靛蓝',
  violet: '紫罗兰',
  pink: '品红',
  orange: '暖橙',
  green: '松绿',
  graphite: '石墨蓝',
};

let checks = 0;
let browser;
const expect = (actual, want, what) => {
  checks += 1;
  if (actual !== want) throw new Error(`${what}：期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(actual)}`);
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    // 浏览器每次导航都会自动请求 /favicon.ico，网页导出里没有这个文件；与主题色无关的既有现象。
    if (/favicon/i.test(url)) return;
    errors.push(m.text() + (url ? ` ← ${url}` : ''));
  });
  page.on('response', (r) =>
    r.status() >= 400 && !/favicon/i.test(r.url()) && errors.push(`HTTP ${r.status()} ${r.url()}`)
  );
  const step = (msg) => process.stderr.write(`· ${msg}\n`);

  let mode = '跟随系统';
  // 首次引导是异步挂载的弹层，晚于首次点击出现。预置「引导已完成」，避免弹层遮挡色块。
  await page.addInitScript(() => localStorage.setItem('zixu.welcome-v1', 'done'));
  const openSettings = async () => {
    await tap(page.getByRole('button', { name: '设置', exact: true }), '设置入口');
    await page.getByText('主题色').first().waitFor();
  };
  const swatch = (key) => page.getByTestId(`theme-accent-${key}`);
  // 选中档的外观按钮使用 primary 样式，它的背景色就是当前生效的强调色。
  const accent = () =>
    page.getByRole('button', { name: mode, exact: true }).evaluate((n) => getComputedStyle(n).backgroundColor);
  const wash = () =>
    page.getByText('外观', { exact: true }).first().evaluate((n) => {
      let el = n.parentElement;
      while (el && getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)') el = el.parentElement;
      return getComputedStyle(el).backgroundColor;
    });
  const setMode = async (label) => {
    await tap(page.getByRole('button', { name: label, exact: true }), label);
    mode = label;
  };
  // 设置页在 RN 内部 ScrollView 里，Playwright 的最小滚动会把目标推到容器边缘，
  // 落到相邻字段下面；切换外观后还有短淡入，两层页面叠加时会遮住目标。
  // 先把目标滚到视口中央，等它成为命中元素，再按坐标点它。
  const tap = async (locator, what) => {
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    let spot = null;
    for (let i = 0; i < 24; i += 1) {
      spot = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const top = document.elementFromPoint(cx, cy);
        const ready = !!top && (top === el || el.contains(top));
        return ready ? { x: cx, y: cy } : null;
      });
      if (spot) break;
      await page.waitForTimeout(150);
      if (i === 23) throw new Error(`${what} 被其他层遮挡，3.6 秒内无法命中`);
    }
    // 按坐标发真实鼠标事件：locator.click 会自行滚动，把目标重新推到相邻字段下面。
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(250);
  };
  const pick = async (key) => {
    await tap(swatch(key), NAMES[key] + ' 色块');
    expect(await page.getByText(`主题色 · ${NAMES[key]}`).count(), 1, `${NAMES[key]} 状态文字`);
  };

  await page.goto(BASE);
  step('打开设置页');
  await openSettings();
  expect(await page.getByTestId(/^theme-accent-/).count(), 8, '外观板块出现八个主题色色块');
  expect(await accent(), rgb(LIGHT.teal), '默认强调色仍为 0.7.0 青绿');
  expect(await wash(), rgb('F1F4F3'), '默认中性底未被染色');
  await page.screenshot({ path: path.join(OUT, '01-浅色-青绿.png') });

  step('默认青绿通过');
  await pick('pink');
  expect(await accent(), rgb(LIGHT.pink), '品红强调色');
  expect(await wash(), rgb('F8F0F2'), '中性底跟随品红');
  await page.screenshot({ path: path.join(OUT, '02-浅色-品红.png') });

  await page.reload();
  step('刷新后复检');
  await openSettings();
  expect(await accent(), rgb(LIGHT.pink), '刷新后仍是品红（网页偏好持久化）');
  expect(await page.evaluate(() => localStorage.getItem('zixu.accent')), 'pink', '偏好写入 localStorage');

  step('切深色');
  await setMode('深色');
  expect(await accent(), rgb(DARK.pink), '深色端沿用品红');
  await page.screenshot({ path: path.join(OUT, '03-深色-品红.png') });
  await pick('blue');
  expect(await accent(), rgb(DARK.blue), '深色端海蓝');
  await page.reload();
  await openSettings();
  expect(await accent(), rgb(DARK.blue), '深色端换色跨刷新保留');

  step('逐色遍历');
  await setMode('浅色');
  // 进示例模式，让三个页面都有内容可看；示例只存在内存，不写入用户记忆。
  await tap(page.getByRole('button', { name: '返回', exact: true }), '返回');
  await tap(page.getByRole('button', { name: '先看看示例' }), '进入示例');
  await page.getByText('示例内容 · 不属于你的记忆').waitFor();
  await openSettings();
  for (const key of ['teal', 'indigo', 'violet', 'orange', 'green', 'graphite']) {
    await pick(key);
    // 设置页是 Sheet（RN Modal），打开时底部导航本来就在弹层之后，先返回再切标签。
    await tap(page.getByRole('button', { name: '返回', exact: true }), '返回');
    for (const name of ['认识我', '回忆', '记录']) {
      await tap(page.getByRole('tab', { name, exact: true }), name);
    }
    await page.getByRole('button', { name: '记一条', exact: true }).isVisible();
    await openSettings();
    expect(await accent(), rgb(LIGHT[key]), `${NAMES[key]} 切换后整页生效`);
    if (key === 'green') {
      await tap(page.getByRole('button', { name: '返回', exact: true }), '返回');
      const shots = [
        ['记录', '07-记录页-松绿'],
        ['认识我', '08-认识我-松绿'],
        ['回忆', '09-回忆页-松绿'],
      ];
      for (const [name, file] of shots) {
        await tap(page.getByRole('tab', { name, exact: true }), name);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, `${file}.png`) });
      }
      await openSettings();
    }
    expect(await accent(), rgb(LIGHT[key]), `${NAMES[key]} 切换后整页生效`);
  }
  await page.screenshot({ path: path.join(OUT, '04-浅色-石墨蓝.png') });

  step('窄屏检查');
  await pick('pink');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(300);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="theme-accent-"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { key: el.getAttribute('data-testid'), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    })
  );
  expect(boxes.length, 8, '320 窄屏仍是八个色块');
  expect(boxes.every((b) => b.left >= 0 && b.right <= 320), true, '320 窄屏色块未溢出屏幕');
  const overlaps = boxes.filter((b, i) => i && b.left < boxes[i - 1].right);
  expect(overlaps.length, 0, '320 窄屏色块未互相重叠');
  await page.screenshot({ path: path.join(OUT, '05-窄屏-320.png') });

  step('复位');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(250);
  await pick('teal');
  await setMode('跟随系统');
  expect(await accent(), rgb(LIGHT.teal), '复位后强调色');
  expect(await wash(), rgb('F1F4F3'), '复位后中性底');
  await page.screenshot({ path: path.join(OUT, '06-复位-青绿.png') });

  console.log(`主题色冒烟：${checks} 项断言通过`);
  if (errors.length) {
    console.error('页面报错：\n' + [...new Set(errors)].join('\n'));
    process.exitCode = 1;
  }
})()
  .catch((e) => {
    console.error(String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
  });
