import type { ModelConfig } from './core';
export const providers = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: '' },
  { id: 'glm', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: '' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: '' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '' },
  { id: 'custom', name: '自定义兼容接口', baseUrl: '', model: '' },
];
export const defaultConfig = (id: string): ModelConfig => {
  const p = providers.find(p => p.id === id) || providers[0];
  return { baseUrl: p.baseUrl, model: p.model, key: '' };
};
export const providerId = (config: ModelConfig) => providers.find(p => p.baseUrl.replace(/\/$/, '') === config.baseUrl.replace(/\/$/, ''))?.id || 'custom';
