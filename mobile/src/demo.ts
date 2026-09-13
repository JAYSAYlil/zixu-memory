import type { Library } from './core';
export function demoLibrary(): Library {
  const date = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 24, 0, 0);
    return d.toISOString();
  };
  const rows = [
    [
      'demo-1',
      '日常',
      '下班绕了点路。\n经过那家总是关门的书店，今天居然开着。进去待了半小时，什么也没买。',
      0,
      18,
    ],
    ['demo-2', '想法', '比起把一天安排得很满，我好像更需要一点没有安排的时间。', 1, 21],
    [
      'demo-3',
      '工作',
      '这次自己定了项目的节奏，做起来反而没那么累。原来让我烦的，可能是一直被临时打断。',
      3,
      20,
    ],
    ['demo-4', '关系', '和老朋友吃饭，从六点聊到九点。不用解释太多的感觉，真好。', 5, 22],
  ] as const;
  return {
    version: 1,
    draft: '',
    memories: rows.map(([id, category, text, days, hour]) => ({
      id,
      category,
      text,
      createdAt: date(days, hour),
      updatedAt: date(days, hour),
      starred: id === 'demo-2',
      attachments: [],
      history: [],
    })),
    insights: [
      {
        id: 'demo-i1',
        text: '我希望每天能留一点自己安排的时间。',
        category: '在意的事',
        status: 'confirmed',
        origin: 'self',
        sourceIds: [],
        createdAt: date(1, 22),
        history: [],
      },
      {
        id: 'demo-i2',
        text: '在这几次记录中，能否自己安排节奏，似乎比忙不忙更影响你的感受。',
        category: '行为模式',
        status: 'pending',
        origin: 'ai',
        sourceIds: ['demo-2', 'demo-3'],
        model: '示例观察 · 非真实分析',
        createdAt: date(0, 20),
        history: [],
      },
    ],
  };
}
