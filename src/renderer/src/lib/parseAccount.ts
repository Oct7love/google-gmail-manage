/**
 * 解析一行账号信息，兼容多种「卡密」格式：
 * 1. "账号 密码 [辅邮] 2fa密钥"（空格/Tab 分隔，2FA 密钥中间可能有空格）
 * 2. "账号----密码----[辅邮]----2fa密钥----[链接]"（4 个短横线分隔）
 * 3. "邮箱|密码|辅邮|2FA|10组8位备份码|国家|手机号码"（竖线分隔，完整卡密）
 *    2FA 可缺省，如 "邮箱|密码|辅邮|国家|手机"——解析出的 totpSecret 为空字符串。
 *
 * 第 1 段固定是账号、第 2 段固定是登录密码；其余段按**内容**识别，
 * 因为辅邮/链接/备份码等有时有、有时没有，不能死按位置取：
 *   - 链接：http(s):// 开头
 *   - 2FA：otpauth:// 链接，或 base32 风格密钥（≥16 位、仅 A-Z2-7）
 *   - 辅邮：形如 a@b.c 的合法邮箱
 *   - 备份码：逗号/空格分隔的多组数字（10 组 8 位）→ 归入 note
 *   - 手机号：纯数字（7~15 位，可带 +）→ 归入 note
 *   - 国家：纯字母词（可含空格，如 United States）→ 归入 note
 * 备份码/国家/手机这三项不单独建字段，统一拼进 note（备注）。
 *
 * 返回 null 表示无法识别（至少要有 账号 + 密码 + 2FA）。
 */
export interface ParsedAccount {
  email: string;
  googlePassword: string;
  recoveryEmail: string;
  totpSecret: string;
  link?: string;
  /** 备份码 / 国家 / 手机号等附加信息，拼成多行文本存进备注 */
  note?: string;
}

/** 合法邮箱：有且仅有一个 @，且域名带点（区分密码里的 a@123 这种伪邮箱） */
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** base32 风格的 2FA 密钥：仅 A-Z/a-z/2-7，长度 ≥16（短词如国家名不会误判） */
function looksLikeTotpSecret(s: string): boolean {
  return /^[A-Za-z2-7]{16,}$/.test(s);
}

/** 备份码：逗号/空格分隔的 ≥3 组数字（每组 6~9 位） */
function looksLikeBackupCodes(s: string): boolean {
  return /^\d{6,9}([,，\s]+\d{6,9}){2,}$/.test(s.trim());
}

/** 手机号：纯数字 7~15 位，可带前导 + */
function looksLikePhone(s: string): boolean {
  return /^\+?\d{7,15}$/.test(s);
}

/** 国家：字母词，可含空格（United States），长度 2~30 */
function looksLikeCountry(s: string): boolean {
  return /^[A-Za-z][A-Za-z ]{1,29}$/.test(s);
}

/**
 * 完整内容识别（用于 | 和 ---- 这类「每段是完整字段」的格式）。
 * email/password 取前两段，其余按内容归类，备份码/国家/手机拼进 note。
 */
function classifyFields(parts: string[]): ParsedAccount | null {
  if (parts.length < 3) return null;

  const email = parts[0];
  // 首段必须是合法邮箱，否则当垃圾行丢弃
  if (!looksLikeEmail(email)) return null;
  const googlePassword = parts[1];
  const rest = parts.slice(2);

  let link: string | undefined;
  let recoveryEmail = '';
  let totpSecret = '';
  const noteSegments: string[] = [];

  for (const p of rest) {
    if (!link && /^https?:\/\//i.test(p)) {
      link = p;
    } else if (/^otpauth:\/\//i.test(p)) {
      totpSecret = p;
    } else if (!recoveryEmail && looksLikeEmail(p)) {
      recoveryEmail = p;
    } else if (looksLikeBackupCodes(p)) {
      noteSegments.push(`备份码：${p.replace(/\s+/g, '')}`);
    } else if (!totpSecret && looksLikeTotpSecret(p)) {
      totpSecret = p;
    } else if (looksLikePhone(p)) {
      noteSegments.push(`手机：${p}`);
    } else if (looksLikeCountry(p)) {
      noteSegments.push(`国家：${p}`);
    } else {
      noteSegments.push(p);
    }
  }

  // 2FA 允许为空（有些卡密不含 2FA）：字段保留，值为空字符串，登录后可再补填
  return {
    email,
    googlePassword,
    recoveryEmail,
    totpSecret,
    link,
    note: noteSegments.length > 0 ? noteSegments.join('\n') : undefined,
  };
}

/**
 * 空格/Tab 格式：旧的简单卡密「账号 密码 [辅邮] 2fa」。
 * 2FA 密钥可能被空格拆成多段，所以无法归类的尾段全部拼回 2FA。
 */
function classifySpaceSeparated(tokens: string[]): ParsedAccount | null {
  if (tokens.length < 3) return null;

  const email = tokens[0];
  const googlePassword = tokens[1];
  const rest = tokens.slice(2);

  let link: string | undefined;
  let recoveryEmail = '';
  const totpParts: string[] = [];

  for (const p of rest) {
    if (!link && /^https?:\/\//i.test(p)) {
      link = p;
    } else if (/^otpauth:\/\//i.test(p)) {
      totpParts.push(p);
    } else if (!recoveryEmail && looksLikeEmail(p)) {
      recoveryEmail = p;
    } else {
      totpParts.push(p);
    }
  }

  const totpSecret = totpParts.join(' ');
  if (!totpSecret) return null;

  return { email, googlePassword, recoveryEmail, totpSecret, link };
}

export function parseAccountLine(raw: string): ParsedAccount | null {
  const s = raw.trim();
  if (!s) return null;

  // 格式 3：竖线分隔（完整卡密）
  if (s.includes('|')) {
    const parts = s.split('|').map((p) => p.trim()).filter(Boolean);
    return classifyFields(parts);
  }

  // 格式 2：---- 分隔
  if (/-{4,}/.test(s)) {
    const parts = s.split(/-{4,}/).map((p) => p.trim()).filter(Boolean);
    return classifyFields(parts);
  }

  // 格式 1：空格/Tab 分隔
  const tokens = s.split(/[ \t]+/).filter(Boolean);
  return classifySpaceSeparated(tokens);
}

/** 从备注里提取「手机：xxx」的手机号，给接码框预填用；没有返回 undefined */
export function extractPhoneFromNote(note?: string | null): string | undefined {
  if (!note) return undefined;
  const m = note.match(/手机[:：]\s*(\+?\d{6,15})/);
  return m ? m[1] : undefined;
}

/** 解析多行文本，过滤掉无效行 */
export function parseAccountLines(raw: string): ParsedAccount[] {
  return raw
    .split(/\r?\n/)
    .map((l) => parseAccountLine(l))
    .filter((a): a is ParsedAccount => a !== null);
}
