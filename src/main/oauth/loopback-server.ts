import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

export interface LoopbackResult {
  /** URL-encoded 参数，比如 ?code=...&state=... */
  query: Record<string, string>;
  /** 接收到重定向请求时用于返回给用户浏览器的可见页面 */
  closeMessage?: string;
}

const SUCCESS_HTML = `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>授权成功</title>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;
             display:flex;align-items:center;justify-content:center;
             min-height:100vh;margin:0;background:#fafafa;color:#1a1a1a">
  <div style="text-align:center">
    <div style="font-size:48px">✅</div>
    <h1 style="font-size:20px;margin:12px 0 4px">授权成功</h1>
    <p style="color:#666">可以关闭这个标签页，回到 MailViewer</p>
  </div>
</body></html>`;

const ERROR_HTML = (msg: string): string => `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>授权失败</title>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;
             display:flex;align-items:center;justify-content:center;
             min-height:100vh;margin:0;background:#fafafa;color:#1a1a1a">
  <div style="text-align:center;max-width:400px">
    <div style="font-size:48px">❌</div>
    <h1 style="font-size:20px;margin:12px 0 4px">授权失败</h1>
    <p style="color:#c00">${msg}</p>
    <p style="color:#666">回到 MailViewer 重试</p>
  </div>
</body></html>`;

/**
 * 启动一个临时 loopback HTTP server，等待浏览器重定向回来带 code。
 * 返回 { redirectUri, waitForCode(), close() }。
 */
export function startLoopbackServer(): Promise<{
  redirectUri: string;
  waitForCode: (timeoutMs?: number) => Promise<Record<string, string>>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    let pendingResolve: ((q: Record<string, string>) => void) | null = null;
    let pendingReject: ((e: Error) => void) | null = null;
    let timer: NodeJS.Timeout | null = null;

    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/') {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => (query[k] = v));

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (query.error) {
        res.end(ERROR_HTML(query.error_description || query.error));
      } else {
        res.end(SUCCESS_HTML);
      }

      if (pendingResolve) {
        pendingResolve(query);
        pendingResolve = null;
        pendingReject = null;
      }
    });

    server.on('error', reject);

    // 监听系统分配的端口
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const redirectUri = `http://127.0.0.1:${addr.port}`;

      resolve({
        redirectUri,
        waitForCode: (timeoutMs = 120000) =>
          new Promise((res, rej) => {
            pendingResolve = res;
            pendingReject = rej;
            timer = setTimeout(() => {
              if (pendingReject) {
                pendingReject(new Error('授权超时，未在 2 分钟内收到回调'));
                pendingResolve = null;
                pendingReject = null;
              }
            }, timeoutMs);
          }),
        close: () => {
          if (timer) clearTimeout(timer);
          server.close();
        },
      });
    });
  });
}
