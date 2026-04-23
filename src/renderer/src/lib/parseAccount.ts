/**
 * 解析一行账号信息，兼容两种格式：
 * 1. "账号 密码 辅邮 2fa密钥"（空格/Tab 分隔，2FA 密钥中间可能有空格，按前 3 段之后全归 2FA 处理）
 * 2. "账号----密码----辅邮----2fa密钥----链接"（4+ 个短横线分隔，链接可选）
 *
 * 返回 null 表示无法识别。
 */
export interface ParsedAccount {
  email: string;
  googlePassword: string;
  recoveryEmail: string;
  totpSecret: string;
  link?: string;
}

export function parseAccountLine(raw: string): ParsedAccount | null {
  const s = raw.trim();
  if (!s) return null;

  // 格式 2：包含 ---- 分隔符
  if (/-{4,}/.test(s)) {
    const parts = s.split(/-{4,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) return null;
    return {
      email: parts[0],
      googlePassword: parts[1],
      recoveryEmail: parts[2],
      totpSecret: parts[3],
      link: parts[4] || undefined,
    };
  }

  // 格式 1：空格/Tab 分隔。前 3 段是 email/password/recovery，余下全归 2FA
  const tokens = s.split(/[ \t]+/).filter(Boolean);
  if (tokens.length < 4) return null;
  const totpSecret = tokens.slice(3).join(' ');
  return {
    email: tokens[0],
    googlePassword: tokens[1],
    recoveryEmail: tokens[2],
    totpSecret,
  };
}

/** 解析多行文本，过滤掉无效行 */
export function parseAccountLines(raw: string): ParsedAccount[] {
  return raw
    .split(/\r?\n/)
    .map((l) => parseAccountLine(l))
    .filter((a): a is ParsedAccount => a !== null);
}
