/**
 * Google Translate 免费公开 endpoint：translate.googleapis.com/translate_a/single
 * 无 API key，单次上限 ~5000 字符。
 *
 * 策略：
 * 1. 调用方先做预清理（去 URL / 归一化换行）
 * 2. 按段落拆分，每段独立翻译，再用 \n\n 拼回 → 保留原文段落结构
 * 3. 超长段落按 4500 字硬切，兜底不丢内容
 */

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MAX_CHARS_PER_CALL = 4500;
const TARGET = 'zh-CN';

export async function translateToChinese(text: string): Promise<string> {
  const cleaned = preprocessText(text);
  if (!cleaned.trim()) return '';

  const paragraphs = cleaned.split(/\n\s*\n/);
  const out: string[] = [];
  for (const p of paragraphs) {
    if (!p.trim()) {
      out.push('');
      continue;
    }
    out.push(await translateParagraph(p));
  }
  return out.join('\n\n');
}

async function translateParagraph(p: string): Promise<string> {
  if (p.length <= MAX_CHARS_PER_CALL) return translateOne(p);
  // 单段过长，硬切（极少见）
  const chunks: string[] = [];
  for (let i = 0; i < p.length; i += MAX_CHARS_PER_CALL) {
    chunks.push(p.slice(i, i + MAX_CHARS_PER_CALL));
  }
  const parts = await Promise.all(chunks.map(translateOne));
  return parts.join('');
}

async function translateOne(text: string): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: TARGET,
    dt: 't',
    q: text,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: '*/*',
    },
  });
  if (!res.ok) throw new Error(`翻译服务返回 ${res.status}`);
  const data = (await res.json()) as unknown;
  return parseResponse(data);
}

function parseResponse(data: unknown): string {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  const sentences = data[0] as unknown[];
  const parts: string[] = [];
  for (const s of sentences) {
    if (Array.isArray(s) && typeof s[0] === 'string') parts.push(s[0]);
  }
  return parts.join('');
}

/**
 * 翻译前清理：
 * - 去掉 (https://...) 和裸 URL
 * - 去掉 [image: xxx] / [cid: xxx] / 零宽字符
 * - 删掉光秃秃的一行 `=====` 这种分割线
 * - 合并多余空白但保留 \n\n 段落
 */
function preprocessText(text: string): string {
  return text
    .replace(/\(https?:\/\/[^)\s]+\)/g, ' ')
    .replace(/<https?:\/\/[^>\s]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[image:[^\]]*\]/gi, '')
    .replace(/\[cid:[^\]]*\]/gi, '')
    .replace(/[​-‍﻿]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, i, arr) => {
      // 去掉全是 -===_~ 这种装饰线
      if (/^[-=_~*.·─-╿]+$/.test(line)) return false;
      // 连续空行只保留一个
      if (line === '' && arr[i - 1] === '') return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
