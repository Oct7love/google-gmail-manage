import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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

export function createAccountInfoStore(filePath: string, key: Buffer): AccountInfoStore {
  function readAll(): InfoMap {
    if (!existsSync(filePath)) return {};
    try {
      const data = decryptJson(readFileSync(filePath), key);
      return data && typeof data === 'object' ? (data as InfoMap) : {};
    } catch {
      // 文件损坏 / 被篡改 / 密钥不匹配：当作空，不让整个 App 崩
      return {};
    }
  }

  function writeAll(map: InfoMap): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, encryptJson(map, key), { mode: 0o600 });
  }

  return {
    get(email) {
      return readAll()[email] ?? null;
    },
    set(email, info) {
      const map = readAll();
      map[email] = info;
      writeAll(map);
    },
    delete(email) {
      const map = readAll();
      if (email in map) {
        delete map[email];
        writeAll(map);
      }
    },
  };
}
