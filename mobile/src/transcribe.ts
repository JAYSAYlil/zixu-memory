import { Platform } from 'react-native';
import { endpoint, type Attachment, type ModelConfig } from './core';
import type { RequestOptions } from './ai';

export async function transcribe(
  config: ModelConfig,
  attachment: Attachment,
  options: RequestOptions = {},
): Promise<NonNullable<Attachment['transcript']>> {
  if (!config.key.trim() || !config.model.trim())
    throw new Error('先在设置中填写独立的语音转写地址、模型和 Key。');
  const url = endpoint(config.baseUrl).replace(/\/chat\/completions$/, '/audio/transcriptions');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, 120000);
  try {
    options.onStage?.('正在上传所选录音并转写…');
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(attachment.uri, { signal: controller.signal })).blob();
      form.append('file', blob, attachment.name);
    } else
      form.append('file', {
        uri: attachment.uri,
        name: attachment.name,
        type: attachment.mime,
      } as any);
    form.append('model', config.model.trim());
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.key.trim()}` },
      body: form,
    });
    if (!response.ok)
      throw new Error(
        `语音服务返回 HTTP ${response.status}。请检查 Key、额度、文件大小及模型是否支持带时间戳的转写。`,
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('语音服务响应格式不正确，请检查接口兼容性。');
    }
    if (controller.signal.aborted) throw new Error('请求已取消');
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 100000)
      throw new Error('服务商未返回有效转写。');
    const segments = Array.isArray(data.segments)
      ? data.segments
          .filter(
            (s: any) =>
              typeof s.text === 'string' &&
              s.text.length <= 100000 &&
              Number.isFinite(s.start) &&
              s.start >= 0 &&
              Number.isFinite(s.end) &&
              s.end >= s.start,
          )
          .slice(0, 10000)
          .map((s: any) => ({ start: s.start, end: s.end, text: s.text }))
      : [];
    return { text: data.text, segments };
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        options.signal?.aborted ? '已取消转写，录音仍在本机。' : '转写超时，录音仍在本机。',
      );
    if (e instanceof TypeError) throw new Error('转写连接失败，请检查网络或语音服务地址。');
    throw e;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
