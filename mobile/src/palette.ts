export type ThemeAccent =
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'orange'
  | 'green'
  | 'graphite';

export const accentOrder: ThemeAccent[] = [
  'teal',
  'blue',
  'indigo',
  'violet',
  'pink',
  'orange',
  'green',
  'graphite',
];

export const accentNames: Record<ThemeAccent, string> = {
  teal: '青绿',
  blue: '海蓝',
  indigo: '靛蓝',
  violet: '紫罗兰',
  pink: '品红',
  orange: '暖橙',
  green: '松绿',
  graphite: '石墨蓝',
};

export const isThemeAccent = (value: unknown): value is ThemeAccent =>
  typeof value === 'string' && (accentOrder as string[]).includes(value);

/** 与主题色无关的中性角色。砖红固定为危险色，不随所选色相改变。 */
export const neutralColors = {
  light: {
    paper: '#FFFFFF',
    ink: '#191C1B',
    muted: '#636967',
    line: '#D8DEDC',
    white: '#FFFFFF',
    error: '#BA3131',
  },
  dark: {
    // 深色端保持中性深灰体系：页面近黑、卡片上浮，强调色提亮保证暗处可读。
    paper: '#0B0C0D',
    ink: '#E4E6E5',
    muted: '#9CA1A0',
    line: '#3A3D40',
    white: '#FFFFFF',
    error: '#FFB4AB',
  },
};

/** 一套主题色在单个明暗端上的着色角色。 */
export type AccentRoles = {
  accent: string;
  accentLight: string;
  accentDark: string;
  onAccent: string;
  confirmedDot: string;
};

/**
 * 强调色按 Material 3 的色调思路标定：浅色端 accent 取 tone 40 一档、accentLight 容器取 tone 90 一档，
 * 深色端 accent 取 tone 80、容器取 tone 30，避免单纯调亮调暗同时丢掉饱和度和可读性。
 * 青绿是自叙既有主色，数值与 0.7.0 完全一致，保证默认观感不变。
 * confirmedDot 是「已确认观察」圆点的颜色：青绿沿用既有橄榄绿次要色，其余主题色跟随自身强调色。
 */
export const accentPalettes: Record<ThemeAccent, { light: AccentRoles; dark: AccentRoles }> = {
  teal: {
    light: {
      accent: '#087F73',
      accentLight: '#CFF2EC',
      accentDark: '#0B6E64',
      onAccent: '#FFFFFF',
      confirmedDot: '#2F7D5C',
    },
    dark: {
      accent: '#3ADBC4',
      accentLight: '#12433D',
      accentDark: '#6FEADD',
      onAccent: '#08251F',
      confirmedDot: '#8BD5B2',
    },
  },
  blue: {
    light: {
      accent: '#1565C0',
      accentLight: '#D8E6FB',
      accentDark: '#0D47A1',
      onAccent: '#FFFFFF',
      confirmedDot: '#1565C0',
    },
    dark: {
      accent: '#8AB4F8',
      accentLight: '#14315C',
      accentDark: '#AECBFA',
      onAccent: '#00213F',
      confirmedDot: '#8AB4F8',
    },
  },
  indigo: {
    light: {
      accent: '#3F51B5',
      accentLight: '#E0E3F7',
      accentDark: '#283593',
      onAccent: '#FFFFFF',
      confirmedDot: '#3F51B5',
    },
    dark: {
      accent: '#A6B4FF',
      accentLight: '#232B5C',
      accentDark: '#C5CBFF',
      onAccent: '#111A4E',
      confirmedDot: '#A6B4FF',
    },
  },
  violet: {
    light: {
      accent: '#7A4FBF',
      accentLight: '#EDE2FA',
      accentDark: '#552B8A',
      onAccent: '#FFFFFF',
      confirmedDot: '#7A4FBF',
    },
    dark: {
      accent: '#CFA9F5',
      accentLight: '#3A2456',
      accentDark: '#E3D0FB',
      onAccent: '#2C0A4A',
      confirmedDot: '#CFA9F5',
    },
  },
  pink: {
    light: {
      accent: '#C2185B',
      accentLight: '#FBD9E6',
      accentDark: '#8E1144',
      onAccent: '#FFFFFF',
      confirmedDot: '#C2185B',
    },
    dark: {
      accent: '#FFA8C4',
      accentLight: '#54132F',
      accentDark: '#FFC9DA',
      onAccent: '#3F0A21',
      confirmedDot: '#FFA8C4',
    },
  },
  orange: {
    light: {
      accent: '#BB5800',
      accentLight: '#FBDFC4',
      accentDark: '#8A3F00',
      onAccent: '#FFFFFF',
      confirmedDot: '#BB5800',
    },
    dark: {
      accent: '#FFB870',
      accentLight: '#4E2A00',
      accentDark: '#FFD3A3',
      onAccent: '#3D1A00',
      confirmedDot: '#FFB870',
    },
  },
  green: {
    light: {
      accent: '#2E7D32',
      accentLight: '#CDEFCE',
      accentDark: '#1B5E20',
      onAccent: '#FFFFFF',
      confirmedDot: '#2E7D32',
    },
    dark: {
      accent: '#87D68C',
      accentLight: '#1B3A1E',
      accentDark: '#A9E5AC',
      onAccent: '#0A2A11',
      confirmedDot: '#87D68C',
    },
  },
  graphite: {
    light: {
      accent: '#455A64',
      accentLight: '#D9E2E7',
      accentDark: '#2A3B44',
      onAccent: '#FFFFFF',
      confirmedDot: '#455A64',
    },
    dark: {
      accent: '#A8C0CC',
      accentLight: '#23323A',
      accentDark: '#C6D8E1',
      onAccent: '#121F26',
      confirmedDot: '#A8C0CC',
    },
  },
};

// 中性底只染到能保住框上文字对比度的程度，强度由 tests/palette.test.ts 守住；
// 描边 line 刻意不带色相，否则整页会到处泛色。锚点与强度取到青绿恰好落回 0.7.0 的既有 wash 数值。
const washNeutral = { light: '#F7F4F4', dark: '#252326' };
const washTint = { light: 0.14, dark: 0.09 };

const hexChannel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);

export function mix(from: string, to: string, amount: number) {
  const channel = (at: number) =>
    Math.round(hexChannel(from, at) * (1 - amount) + hexChannel(to, at) * amount)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export const washFor = (dark: boolean, container: string) =>
  mix(
    dark ? washNeutral.dark : washNeutral.light,
    container,
    dark ? washTint.dark : washTint.light
  );

/** 色块上的勾号取色：亮底用近黑，暗底用纯白，取决于该端实际显示的色块明度。 */
export const inkOn = (hex: string) => {
  const bright =
    0.2126 * (hexChannel(hex, 1) / 255) +
    0.7152 * (hexChannel(hex, 3) / 255) +
    0.0722 * (hexChannel(hex, 5) / 255);
  return bright > 0.5 ? '#171A19' : '#FFFFFF';
};
