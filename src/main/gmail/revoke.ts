/**
 * 撤销一个 refresh token。忽略网络错误——删除账号时即便 revoke 失败也要继续清本地。
 */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`;
    await fetch(url, { method: 'POST' });
  } catch {
    // 静默忽略
  }
}
