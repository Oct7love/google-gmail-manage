import { describe, it, expect } from 'vitest';
import { buildMessageSrcDoc } from './messageSrcDoc';
import type { MessageDetail } from '../../../shared/types';

const base: MessageDetail = {
  accountEmail: 'a@x.com',
  messageId: 'm1',
  threadId: null,
  subject: 's',
  fromAddr: 'f@x.com',
  dateTs: 0,
  snippet: '',
  fetchedAt: 0,
  bodyHtml: '<p>hi <img src="https://track.example/pixel.gif"></p>',
  bodyText: null,
};

function cspOf(doc: string): string {
  const m = doc.match(/Content-Security-Policy" content="([^"]*)"/);
  return m ? m[1] : '';
}

describe('buildMessageSrcDoc — 图片 CSP', () => {
  it('关图片时 img-src 只允许 data:，绝不含 https:（防追踪像素）', () => {
    const csp = cspOf(buildMessageSrcDoc(base, false));
    expect(csp).toContain('img-src data:');
    expect(csp).not.toContain('https:');
  });

  it('开图片时 img-src 才放行 https:', () => {
    const csp = cspOf(buildMessageSrcDoc(base, true));
    expect(csp).toMatch(/img-src[^;]*https:/);
  });

  it('始终禁 JS（default-src none）', () => {
    expect(cspOf(buildMessageSrcDoc(base, false))).toContain("default-src 'none'");
  });

  it('纯文本邮件做 HTML 转义，防注入', () => {
    const textMsg = { ...base, bodyHtml: null, bodyText: '<script>alert(1)</script>' };
    const doc = buildMessageSrcDoc(textMsg, false);
    expect(doc).toContain('&lt;script&gt;');
    expect(doc).not.toContain('<script>alert(1)</script>');
  });
});
