import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme, lightColors } from './theme';
export type IconName =
  | 'write'
  | 'book'
  | 'person'
  | 'search'
  | 'settings'
  | 'plus'
  | 'arrow'
  | 'back'
  | 'close'
  | 'mic'
  | 'photo'
  | 'camera'
  | 'play'
  | 'pause'
  | 'check'
  | 'star'
  | 'download'
  | 'upload';
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { C } = useTheme();
  const paths: Partial<Record<IconName, string>> = {
    write: 'M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z',
    book: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16',
    person: 'M4 21v-2a8 8 0 0 1 16 0v2',
    search: 'M16 16l5 5',
    settings: 'M4 7h16M4 17h16',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M4 12h15M14 6l6 6-6 6',
    back: 'M20 12H5M10 6l-6 6 6 6',
    close: 'M6 6l12 12M18 6L6 18',
    mic: 'M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6',
    photo: 'M3 17l5-5 4 4 3-3 6 5',
    camera: 'M3 6h4l2-3h6l2 3h4v15H3z',
    play: 'M8 4l12 8-12 8z',
    pause: 'M8 5v14M16 5v14',
    check: 'M5 12l4 4L20 5',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
    download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
    upload: 'M12 16V4M7 9l5-5 5 5M4 16v5h16v-5',
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? C.ink}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={paths[name]} />
      {name === 'person' && <Circle cx={12} cy={7} r={4} />}
      {name === 'camera' && <Circle cx={12} cy={13} r={4} />}
      {name === 'search' && <Circle cx={10} cy={10} r={7} />}
      {name === 'mic' && <Rect x={9} y={2} width={6} height={13} rx={3} />}
      {name === 'photo' && (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={2} />
          <Circle cx={15.5} cy={8} r={1.5} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx={9} cy={7} r={3} fill={C.paper} />
          <Circle cx={16} cy={17} r={3} fill={C.paper} />
        </>
      )}
    </Svg>
  );
}
export function Button({
  label,
  onPress,
  icon,
  primary,
  disabled,
  compact,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const scale = useRef(new Animated.Value(1)).current;
  const setPressed = (pressed: boolean) => {
    Animated.spring(scale, {
      toValue: pressed ? 0.97 : 1,
      stiffness: 500,
      damping: 50,
      mass: 1,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.4 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.button, compact && { paddingHorizontal: 12 }, primary && { backgroundColor: C.accent, borderColor: C.accent }]}
      >
        {icon && <Icon name={icon} size={18} color={primary ? C.onAccent : C.ink} />}
        <Text style={[styles.buttonText, primary && { color: C.onAccent }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
  round,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  /** 圆形底衬：图标下方垫一个圆，使其读作圆形按钮。 */
  round?: boolean;
}) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, stiffness: 500, damping: 50, mass: 1, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, stiffness: 500, damping: 50, mass: 1, useNativeDriver: true }).start()}
      style={{
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
        ...(round ? { backgroundColor: C.wash, borderRadius: 23 } : {}),
      }}
    >
      <Icon name={name} color={color} />
    </Pressable>
    </Animated.View>
  );
}
// 与 Button 同一套按压弹簧：按下即刻缩小，抬起弹回，用于筛选片、导航、来源行等轻量触发区。
// 直接动画化 Pressable 本身，避免额外包裹层切断父级的 flex 布局。
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function ScalePressable({
  style,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (value: number) => () =>
    Animated.spring(scale, { toValue: value, stiffness: 500, damping: 50, mass: 1, useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      {...rest}
      style={[{ transform: [{ scale }] }, style]}
      onPressIn={(e) => { spring(0.97)(); rest.onPressIn?.(e); }}
      onPressOut={(e) => { spring(1)(); rest.onPressOut?.(e); }}
    >
      {children}
    </AnimatedPressable>
  );
}
export function Fade({
  children,
  identity,
  style,
  direction = 0,
}: {
  children: React.ReactNode;
  identity?: string;
  style?: ViewStyle;
  /** 切换方向：1 从右侧滑入，-1 从左侧滑入，0 仅淡入。 */
  direction?: number;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      shift.setValue(0);
      return;
    }
    // 页面级切换：新页从移动方向滑入并淡入，缓动与时长对齐课表应用的 emphasized 准则。
    opacity.setValue(0.5);
    shift.setValue(direction * 36);
    const o = Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    });
    const t = Animated.timing(shift, {
      toValue: 0,
      duration: 260,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    });
    Animated.parallel([o, t]).start();
    return () => {
      o.stop();
      t.stop();
    };
  }, [identity, reduce]);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX: shift }] }]}>
      {children}
    </Animated.View>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  return (
    <View style={styles.empty}>
      <View style={{ marginBottom: 18 }}>
        <Svg width={55} height={55} viewBox="0 0 55 55">
          <Path
            d="M10 42V12h24l11 10v20H10M34 12v11h11M17 29h18M17 35h12"
            fill="none"
            stroke={C.accent}
            strokeWidth={1.2}
          />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}
const makeStyles = (C: typeof lightColors) => StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: C.ink },
  empty: { paddingVertical: 36, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 20, lineHeight: 28, color: C.ink, marginBottom: 8 },
  emptyBody: { fontSize: 15, lineHeight: 24, color: C.muted, maxWidth: 300 },
});
