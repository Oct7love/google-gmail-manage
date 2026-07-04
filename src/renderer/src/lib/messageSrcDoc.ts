import type { MessageDetail } from '../../../shared/types';

/**
 * 构造邮件正文 sandboxed iframe 的 srcDoc（纯字符串，无 DOM 依赖，便于单测）。
 *
 * CSP 规范（见 docs/frontend_guideline.md）：
 *   default-src 'none'; style-src 'unsafe-inline'; img-src data: [https: 仅开图片时]; font-src data:;
 * 外部图片默认禁（只 data:，内嵌 cid: 已在主进程转 data URL），用户点按钮才放行 https:。
 * 关键：`https:` 只能在 allowImages 时出现，否则追踪像素会照常发出网络请求（display:none 不阻止请求）。
 */
export function buildMessageSrcDoc(detail: MessageDetail, allowImages: boolean): string {
  const imgSrc = allowImages ? 'data: https:' : 'data:';
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${imgSrc}; font-src data:;`;
  // 关图片时直接 display:none，避免出现破碎图标 + alt 文本
  const imgStyle = allowImages
    ? `img{ max-width: 100%; height: auto; }`
    : `img{ display: none !important; }`;
  const style = `
    body{
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: #1d1d1f;
      padding: 20px 24px;
      margin: 0;
      background: #ffffff;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    a{ color:#2077ff; }
    pre{ white-space: pre-wrap; word-break: break-word; }
    table{ max-width: 100%; }
    ${imgStyle}
  `;

  const body = detail.bodyHtml
    ? detail.bodyHtml
    : `<pre>${escapeHtml(detail.bodyText ?? '（空邮件）')}</pre>`;

  return `<!doctype html><html><head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <style>${style}</style>
    <base target="_blank">
  </head><body>${body}</body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
