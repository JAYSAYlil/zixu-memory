import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { categories, memoryText, scopedMemories, type Memory } from './core';
import { Sheet } from './components';
import { Button, Icon, IconButton, ScalePressable } from './ui';
import { useStyles } from './styles';
import { useTheme } from './theme';

export type RangeScope = { from: string; to: string; category: string; ids: string[] };
export const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const rangeLabel = (from: string, to: string) =>
  !from && !to ? '不限时间' : !to ? `${from} 起` : !from ? `${to} 及以前` : `${from} 至 ${to}`;

// 与课表一致的周一开头月历。日期按本地日历生成，避免 UTC 偏移改变所选日期。
function Calendar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { C } = useTheme();
  const s = useStyles();
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [years, setYears] = useState(false);
  const [yearBase, setYearBase] = useState(Math.floor(initial.getFullYear() / 12) * 12);
  const year = month.getFullYear();
  const m = month.getMonth();
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(year, m + 1, 0).getDate();
  return (
    <View style={s.calendar}>
      <View style={s.calendarHeader}>
        <IconButton
          name="back"
          label={years ? '上一组年份' : '上个月'}
          onPress={() =>
            years ? setYearBase((v) => Math.max(1900, v - 12)) : setMonth(new Date(year, m - 1, 1))
          }
        />
        <Button
          compact
          label={years ? `${yearBase} — ${yearBase + 11}` : `${year} 年 ${m + 1} 月`}
          accessibilityLabel="选择年份"
          onPress={() => {
            setYearBase(Math.floor(year / 12) * 12);
            setYears((v) => !v);
          }}
        />
        <IconButton
          name="arrow"
          label={years ? '下一组年份' : '下个月'}
          onPress={() =>
            years ? setYearBase((v) => Math.min(9988, v + 12)) : setMonth(new Date(year, m + 1, 1))
          }
        />
      </View>
      {years ? (
        <View style={s.yearGrid}>
          {Array.from({ length: 12 }, (_, i) => yearBase + i).map((y) => (
            <Button
              key={y}
              style={{ width: '30%' }}
              compact
              primary={y === year}
              label={`${y}`}
              accessibilityLabel={`选择 ${y} 年`}
              onPress={() => {
                setMonth(new Date(y, m, 1));
                setYears(false);
              }}
            />
          ))}
        </View>
      ) : (
        <>
          <View style={s.calendarWeek}>
            {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <Text key={d} style={[s.meta, { flex: 1, textAlign: 'center' }]}>
                {d}
              </Text>
            ))}
          </View>
          {Array.from({ length: Math.ceil((offset + count) / 7) }, (_, week) => (
            <View key={week} style={s.calendarWeek}>
              {Array.from({ length: 7 }, (_, col) => {
                const day = week * 7 + col - offset + 1;
                if (day < 1 || day > count) return <View key={col} style={{ flex: 1 }} />;
                const date = localDay(new Date(year, m, day));
                const selected = date === value;
                return (
                  <ScalePressable
                    key={col}
                    accessibilityRole="button"
                    accessibilityLabel={`选择日期 ${date}`}
                    accessibilityState={{ selected }}
                    onPress={() => onChange(date)}
                    style={[s.calendarDay, selected && { backgroundColor: C.accent }]}
                  >
                    <Text
                      style={[
                        s.small,
                        {
                          color: selected ? C.onAccent : C.ink,
                          fontWeight: selected ? '700' : '400',
                        },
                      ]}
                    >
                      {day}
                    </Text>
                    {date === localDay(new Date()) && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: selected ? C.onAccent : C.accent,
                        }}
                      />
                    )}
                  </ScalePressable>
                );
              })}
            </View>
          ))}
        </>
      )}
      <Button
        compact
        label="回到本月"
        onPress={() => {
          const now = new Date();
          setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          setYears(false);
        }}
      />
    </View>
  );
}

export function ScopeSheet({
  initial,
  memories,
  observation,
  onClose,
  onApply,
}: {
  initial: RangeScope;
  memories: Memory[];
  observation: boolean;
  onClose: () => void;
  onApply: (scope: RangeScope) => void;
}) {
  const s = useStyles();
  const { C } = useTheme();
  const [scope, setScope] = useState(initial);
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState('');
  const invalid = !!(scope.from && scope.to && scope.from > scope.to);
  const matches = invalid
    ? []
    : scopedMemories(memories, { from: scope.from, to: scope.to, category: scope.category });
  const selected = matches.filter((m) => scope.ids.includes(m.id));
  function preset(days: number) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
    setScope((v) => ({ ...v, from: days ? localDay(start) : '', to: days ? localDay(today) : '' }));
    setEditing(null);
    setError('');
  }
  if (editing)
    return (
      <Sheet
        visible
        title={editing === 'from' ? '选择开始日期' : '选择结束日期'}
        onClose={() => setEditing(null)}
        footer={
          <Button
            label={editing === 'from' ? '不限开始日期' : '不限结束日期'}
            onPress={() => {
              setScope((v) => ({ ...v, [editing]: '' }));
              setEditing(null);
              setError('');
            }}
          />
        }
      >
        <Text style={s.description}>点选日期，或点击年月快速切换年份。</Text>
        <Calendar
          value={scope[editing]}
          onChange={(date) => {
            setScope((v) => ({ ...v, [editing]: date }));
            setEditing(null);
            setError('');
          }}
        />
      </Sheet>
    );
  return (
    <Sheet
      visible
      title={observation ? '选择观察资料' : '回忆范围'}
      onClose={onClose}
      footer={
        <>
          {!!error && (
            <Text accessibilityRole="alert" style={[s.small, { color: C.error }]}>
              {error}
            </Text>
          )}
          <Button
            primary
            label="应用范围"
            disabled={invalid}
            onPress={() => {
              if (observation && scope.ids.length && !selected.length) {
                setError('勾选的经历不在当前范围里，请重新选择，或清除勾选。');
                return;
              }
              onApply({ ...scope, ids: observation ? selected.map((m) => m.id) : scope.ids });
            }}
          />
        </>
      }
    >
      <Text style={s.sectionTitle}>时间</Text>
      <View style={[s.inline, { marginVertical: 12 }]}>
        <Button compact label="不限时间" onPress={() => preset(0)} />
        <Button compact label="近一周" onPress={() => preset(7)} />
        <Button compact label="近一个月" onPress={() => preset(30)} />
      </View>
      <View style={s.dateFields}>
        {(['from', 'to'] as const).map((key) => (
          <ScalePressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === 'from' ? '开始日期' : '结束日期'}
            accessibilityState={{ expanded: editing === key }}
            onPress={() => setEditing(editing === key ? null : key)}
            style={[
              s.dateField,
              editing === key && { borderColor: C.accent, backgroundColor: C.accentLight },
            ]}
          >
            <Text style={s.meta}>{key === 'from' ? '开始日期' : '结束日期'}</Text>
            <Text style={s.small}>{scope[key] || '不限'}</Text>
            <Icon name="chevron" size={16} color={C.muted} />
          </ScalePressable>
        ))}
      </View>
      {invalid && (
        <Text accessibilityRole="alert" style={[s.description, { color: C.error }]}>
          结束日期早于开始日期，请重新选择。
        </Text>
      )}
      <View style={s.rule} />
      <Text style={s.sectionTitle}>分类</Text>
      <View style={[s.inline, { marginTop: 12 }]}>
        {['全部', ...categories].map((category) => (
          <Button
            compact
            key={category}
            label={category}
            primary={scope.category === category}
            onPress={() => {
              setScope((v) => ({ ...v, category }));
              setError('');
            }}
          />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={s.footnote}>
        当前范围内有 {matches.length} 条记录。
      </Text>
      {observation && (
        <>
          <View style={s.rule} />
          <Text style={s.sectionTitle}>挑选经历 · 已选 {selected.length} 条</Text>
          <Text style={s.description}>
            不勾选时，会从这个范围内选取不同时期的经历，最多 30 条。
          </Text>
          {!!scope.ids.length && (
            <Button
              compact
              label="清除经历勾选"
              onPress={() => {
                setScope((v) => ({ ...v, ids: [] }));
                setError('');
              }}
            />
          )}
          {matches.slice(0, limit).map((memory) => (
            <ScalePressable
              key={memory.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`选择经历：${memoryText(memory).slice(0, 80) || '附件记录'}`}
              accessibilityState={{ checked: scope.ids.includes(memory.id) }}
              style={s.pickRow}
              onPress={() => {
                setScope((v) => ({
                  ...v,
                  ids: v.ids.includes(memory.id)
                    ? v.ids.filter((id) => id !== memory.id)
                    : [...v.ids, memory.id],
                }));
                setError('');
              }}
            >
              <View
                style={[
                  s.pickBox,
                  scope.ids.includes(memory.id) && {
                    backgroundColor: C.accent,
                    borderColor: C.accent,
                  },
                ]}
              >
                {scope.ids.includes(memory.id) && (
                  <Icon name="check" size={14} color={C.onAccent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.meta}>
                  {localDay(new Date(memory.createdAt))} · {memory.category}
                </Text>
                <Text numberOfLines={3} style={s.small}>
                  {memoryText(memory) || '附件记录'}
                </Text>
              </View>
            </ScalePressable>
          ))}
          {matches.length > limit && (
            <Button label="显示更多经历" onPress={() => setLimit((v) => v + 50)} />
          )}
        </>
      )}
      <View style={{ marginTop: 20 }}>
        <Button
          compact
          label="清空选择与范围"
          onPress={() => {
            setScope({ from: '', to: '', category: '全部', ids: [] });
            setEditing(null);
            setError('');
          }}
        />
      </View>
    </Sheet>
  );
}
