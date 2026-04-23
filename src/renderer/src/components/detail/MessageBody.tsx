import { useMemo } from 'react';
import type { MessageDetail } from '../../../../shared/types';

interface Props {
  detail: MessageDetail;
  allowImages: boolean;
}

export default function MessageBody({ detail, allowImages }: Props): JSX.Element {
  const srcDoc = useMemo(() => buildSrcDoc(detail, allowImages), [detail, allowImages]);
  return (
    <iframe
      key={`${detail.messageId}:${allowImages ? 'img' : 'noimg'}`}
      title="邮件正文"
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      className="flex-1 w-full border-0"
    />
  );
}

function buildSrcDoc(detail: MessageDetail, allowImages: boolean): string {
  const imgSrc = allowImages ? '*' : 'data:';
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${imgSrc} https:; font-src data:;`;
  // 关图片时直接 display:none，避免出现破碎图标 + alt 文本
  const imgStyle = allowImages
    ? `img{ max-width: 100%; height: auto; }`
    : `img{ display: none !important; }`;
  const style = `
    body{
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      font-size: 14px;
      line-height: 1.65;
      color: #1a1a1a;
      padding: 20px 24px;
      margin: 0;
      background: #ffffff;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    a{ color:#2563eb; }
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
