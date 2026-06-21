import { TOTP, URI } from 'otpauth';

/** 标准 TOTP 周期（秒）。Google 用 30s。 */
export const TOTP_PERIOD = 30;

/**
 * 从用户输入构造一个 TOTP 实例。
 * 支持两种格式：
 *  - `otpauth://...` URI（直接解析，必须是 TOTP 类型）
 *  - 裸 base32 密钥（去空格、转大写后按 SHA1/6 位/30s 构造）
 * 解析失败会抛错，调用方负责 try/catch 显示提示。
 */
export function buildTotp(input: string): TOTP {
  if (input.startsWith('otpauth://')) {
    const parsed = URI.parse(input);
    if (parsed instanceof TOTP) return parsed;
    throw new Error('只支持 TOTP 类型的 otpauth 链接');
  }
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  return new TOTP({
    secret: cleaned,
    algorithm: 'SHA1',
    digits: 6,
    period: TOTP_PERIOD,
  });
}

/**
 * 算当前 6 位码 + 本周期剩余秒数。空输入返回空码。
 * 纯本地计算，不联网。
 */
export function computeTotp(
  secret: string,
  now: number,
): { code: string; error: string | null; remaining: number } {
  const s = secret.trim();
  if (!s) return { code: '', error: null, remaining: TOTP_PERIOD };
  try {
    const totp = buildTotp(s);
    const code = totp.generate({ timestamp: now });
    const remaining = TOTP_PERIOD - Math.floor((now / 1000) % TOTP_PERIOD);
    return { code, error: null, remaining };
  } catch (e) {
    return { code: '', error: e instanceof Error ? e.message : String(e), remaining: TOTP_PERIOD };
  }
}
