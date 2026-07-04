import { useMemo } from 'react';
import type { MessageDetail } from '../../../../shared/types';
import { buildMessageSrcDoc } from '../../lib/messageSrcDoc';

interface Props {
  detail: MessageDetail;
  allowImages: boolean;
}

export default function MessageBody({ detail, allowImages }: Props): JSX.Element {
  const srcDoc = useMemo(() => buildMessageSrcDoc(detail, allowImages), [detail, allowImages]);
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
