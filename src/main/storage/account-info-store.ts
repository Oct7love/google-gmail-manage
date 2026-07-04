import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AccountInfo } from '../../shared/types';

/**
 * 账号附加信息（Google 密码 / 2FA / 辅邮 / 链接）的本地加密存储。
 *
 * 为什么不用 Keychain：未签名的 App 下 macOS 对每条钥匙串记录都会弹"输入密码"，
 * 而账号是按 email 一条条存的，30+ 个频繁轮换的账号 = 几乎每次开凭据都弹框。
 * 这里改成一个本地文件 + AES-256-GCM 加密，彻底不弹框。
 *
 * 安全边界（用户已知情同意）：密钥由机器/用户信息派生，不入库，但可由代码推导，
 * 因此能挡住"直接打开文件就读到明文""被备份到云端"等场景，挡不住以用户身份运行的恶意程序。
 * 鉴于账号是一次性的、应用专用密码仅能读邮件，这个权衡可接受。
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = 'MailViewer.account-info.v1';

export function deriveKey(seed: string): Buffer {
  return scryptSync(seed, SALT, 32);
}

export function encryptJson(value: unknown, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf-8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptJson(blob: Buffer, key: Buffer): unknown {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf-8'));
}

/**
 * 合并账号信息：只覆盖 incoming 里"出现过"（!== undefined）的字段；
 * 传空串表示清除该字段。让调用方能只更新部分字段。
 */
export function mergeAccountInfo(existing: AccountInfo, incoming: AccountInfo): AccountInfo {
  const merged: AccountInfo = { ...existing };
  const fields: (keyof AccountInfo)[] = [
    'googlePassword',
    'totpSecret',
    'recoveryEmail',
    'link',
    'cardLast4',
    'cardExpiry',
    'billingAddress',
    'note',
  ];
  for (const f of fields) {
    if (incoming[f] !== undefined) merged[f] = incoming[f] || undefined;
  }
  return merged;
}

type InfoMap = Record<string, AccountInfo>;

export interface AccountInfoStore {
  get(email: string): AccountInfo | null;
  set(email: string, info: AccountInfo): void;
  delete(email: string): void;
}

/**
 * @param key       主密钥（当前应写入用的密钥）
 * @param fallbackKeys 兜底密钥：主密钥解密失败时依次尝试（如机器用户名短暂取不到导致种子变化）。
 *                     用兜底读到的数据会在下次写入时用主密钥重写，完成迁移。
 */
export function createAccountInfoStore(
  filePath: string,
  key: Buffer,
  fallbackKeys: Buffer[] = [],
): AccountInfoStore {
  /** 依次用主密钥 + 兜底密钥尝试解密；全失败返回 null。 */
  function tryDecrypt(raw: Buffer): InfoMap | null {
    for (const k of [key, ...fallbackKeys]) {
      try {
        const data = decryptJson(raw, k);
        if (data && typeof data === 'object') return data as InfoMap;
      } catch {
        /* 换下一个密钥 */
      }
    }
    return null;
  }

  /** 只读用：解密失败当空、不抛、不动文件（供 get 使用，读操作无副作用）。 */
  function readTolerant(): InfoMap {
    if (!existsSync(filePath)) return {};
    return tryDecrypt(readFileSync(filePath)) ?? {};
  }

  /**
   * 写前读：文件存在但（主密钥+兜底密钥都）解密失败时，
   * **先把坏文件备份成 `.corrupt-<ts>` 再从空开始**，绝不静默拿空 map 覆盖原文件
   * （否则一次损坏 = 全部账号凭据永久丢失）。备份失败则抛错中止写入，宁可这次不保存也不丢旧数据。
   */
  function readForWrite(): InfoMap {
    if (!existsSync(filePath)) return {};
    const raw = readFileSync(filePath);
    const data = tryDecrypt(raw);
    if (data) return data; // 用兜底读到的，writeAll 会以主密钥重写 → 迁移
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try {
      renameSync(filePath, backup);
    } catch (e) {
      throw new Error(
        `account-info 文件损坏且无法备份（${e instanceof Error ? e.message : e}），已中止写入以防丢数据`,
      );
    }
    return {};
  }

  /** 原子写：先写临时文件再 rename 覆盖，避免写入中断留下截断文件。 */
  function writeAll(map: InfoMap): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp-${process.pid}`;
    writeFileSync(tmp, encryptJson(map, key), { mode: 0o600 });
    renameSync(tmp, filePath);
  }

  return {
    get(email) {
      return readTolerant()[email] ?? null;
    },
    set(email, info) {
      const map = readForWrite();
      map[email] = info;
      writeAll(map);
    },
    delete(email) {
      const map = readForWrite();
      if (email in map) {
        delete map[email];
        writeAll(map);
      }
    },
  };
}
