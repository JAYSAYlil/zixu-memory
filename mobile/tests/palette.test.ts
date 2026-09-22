import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accentNames,
  accentOrder,
  accentPalettes,
  inkOn,
  isThemeAccent,
  mix,
  neutralColors,
  washFor,
} from '../src/palette.ts';

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16) / 255;
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const value = channel(hex, at);
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (background: string, foreground: string) => {
  const a = luminance(background);
  const b = luminance(foreground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const sides = accentOrder.map((key) => ({
  key,
  light: accentPalettes[key].light,
  dark: accentPalettes[key].dark,
  washLight: washFor(false, accentPalettes[key].light.accentLight),
  washDark: washFor(true, accentPalettes[key].dark.accentLight),
}));

test('默认青绿保持 0.7.0 的既有数值', () => {
  const teal = accentPalettes.teal;
  assert.equal(teal.light.accent, '#087F73');
  assert.equal(teal.light.accentLight, '#CFF2EC');
  assert.equal(teal.light.accentDark, '#0B6E64');
  assert.equal(teal.light.onAccent, '#FFFFFF');
  assert.equal(teal.light.confirmedDot, '#2F7D5C');
  assert.equal(teal.dark.accent, '#3ADBC4');
  assert.equal(teal.dark.accentLight, '#12433D');
  assert.equal(teal.dark.onAccent, '#08251F');
  assert.equal(teal.dark.confirmedDot, '#8BD5B2');
  assert.equal(washFor(false, teal.light.accentLight), '#F1F4F3');
  assert.equal(washFor(true, teal.dark.accentLight), '#232628');
});

test('主题色在两端互不相同，且都有中文名', () => {
  assert.equal(accentOrder.length, 8);
  for (const end of ['light', 'dark'] as const) {
    const values = accentOrder.map((key) => accentPalettes[key][end].accent);
    assert.equal(new Set(values).size, accentOrder.length, `${end} 端存在重复色值`);
  }
  assert.deepEqual(
    accentOrder.map((key) => accentNames[key]),
    ['青绿', '海蓝', '靛蓝', '紫罗兰', '品红', '暖橙', '松绿', '石墨蓝']
  );
  assert.ok(isThemeAccent('pink'));
  assert.ok(!isThemeAccent('brand'));
  assert.ok(!isThemeAccent(undefined));
});

test('每套主题色的容器文字保持可读', () => {
  for (const side of sides) {
    for (const end of ['light', 'dark'] as const) {
      const roles = side[end];
      assert.ok(
        contrast(roles.accentLight, roles.accentDark) >= 4.5,
        `${side.key} ${end} 容器文字对比度不足`
      );
      assert.ok(
        contrast(roles.accent, roles.onAccent) >= 4.5,
        `${side.key} ${end} 按钮文字对比度不足`
      );
    }
  }
});

test('强调色与确认点在纸面上可辨', () => {
  for (const side of sides) {
    assert.ok(
      contrast(neutralColors.light.paper, side.light.accent) >= 3,
      `${side.key} 浅色强调色在白底上不足`
    );
    assert.ok(
      contrast(neutralColors.dark.paper, side.dark.accent) >= 3,
      `${side.key} 深色强调色在近黑底上不足`
    );
    assert.ok(
      contrast(side.washLight, side.light.confirmedDot) >= 3,
      `${side.key} 浅色确认点在中性底上不足`
    );
    assert.ok(
      contrast(side.washDark, side.dark.confirmedDot) >= 3,
      `${side.key} 深色确认点在中性底上不足`
    );
  }
});

test('中性底染色后正文与次级文字仍保持可读', () => {
  for (const side of sides) {
    assert.ok(contrast(side.washLight, neutralColors.light.ink) >= 7, `${side.key} 浅色正文对比不足`);
    assert.ok(contrast(side.washLight, neutralColors.light.muted) >= 4.5, `${side.key} 浅色次级文字不足`);
    assert.ok(contrast(side.washDark, neutralColors.dark.ink) >= 7, `${side.key} 深色正文对比不足`);
    assert.ok(contrast(side.washDark, neutralColors.dark.muted) >= 4.5, `${side.key} 深色次级文字不足`);
  }
});

test('中性底跟随主题色，中性角色本身不参与换色', () => {
  assert.notEqual(
    washFor(false, accentPalettes.pink.light.accentLight),
    washFor(false, accentPalettes.teal.light.accentLight)
  );
  assert.notEqual(
    mix('#F7F4F4', accentPalettes.teal.light.accentLight, 0.14),
    '#F7F4F4',
    '染色强度不足以产生可见偏移'
  );
  assert.equal(neutralColors.light.error, '#BA3131');
  assert.equal(neutralColors.dark.error, '#FFB4AB');
  assert.equal(neutralColors.light.line, '#D8DEDC');
  assert.equal(neutralColors.dark.line, '#3A3D40');
  for (const side of sides) {
    assert.match(side.washLight, /^#[0-9A-F]{6}$/);
    assert.match(side.washDark, /^#[0-9A-F]{6}$/);
    assert.ok(
      contrast(side.washLight, neutralColors.light.error) >= 4.5,
      `${side.key} 浅色危险文字在染色的中性底上不足`
    );
    assert.ok(
      contrast(side.washDark, neutralColors.dark.error) >= 4.5,
      `${side.key} 深色危险文字在染色的中性底上不足`
    );
  }
});

test('色块上的勾号按实际明度取色', () => {
  assert.equal(inkOn('#FFFFFF'), '#171A19');
  assert.equal(inkOn('#087F73'), '#FFFFFF');
  assert.equal(inkOn('#3ADBC4'), '#171A19');
  assert.equal(inkOn('#C2185B'), '#FFFFFF');
  assert.equal(inkOn('#FFB870'), '#171A19');
});
