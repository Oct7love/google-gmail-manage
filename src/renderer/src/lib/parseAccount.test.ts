import { describe, it, expect } from 'vitest';
import { parseAccountLine, parseAccountLines, extractPhoneFromNote } from './parseAccount';

describe('extractPhoneFromNote', () => {
  it('从备注里提取手机号', () => {
    expect(extractPhoneFromNote('备份码：111\n国家：US\n手机：13800138000')).toBe('13800138000');
  });
  it('全角/半角冒号都认', () => {
    expect(extractPhoneFromNote('手机:19373581145')).toBe('19373581145');
  });
  it('没有手机时返回 undefined', () => {
    expect(extractPhoneFromNote('国家：US')).toBeUndefined();
    expect(extractPhoneFromNote(undefined)).toBeUndefined();
    expect(extractPhoneFromNote('')).toBeUndefined();
  });
});

describe('parseAccountLine — ---- 格式', () => {
  it('账号----密码----辅邮----2fa----链接（五段全有）', () => {
    const r = parseAccountLine(
      'a@gmail.com----PassWord1----recovery@outlook.com----JBSWY3DPEHPK3PXP----http://x.site/code'
    );
    expect(r).toEqual({
      email: 'a@gmail.com',
      googlePassword: 'PassWord1',
      recoveryEmail: 'recovery@outlook.com',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      link: 'http://x.site/code'
    });
  });

  it('辅邮缺失：账号----密码----2fa----链接（用户给的真实样例）', () => {
    const r = parseAccountLine(
      'alejjohns6464@gmail.com----Johnsonalejandra@6907----hguzpqh32v3k4wcgnfpv76274iog5ozp----http://umlmail.site/Mail/GetCodeSMS?token=CO1TdgI5Rp06141834'
    );
    expect(r).toEqual({
      email: 'alejjohns6464@gmail.com',
      googlePassword: 'Johnsonalejandra@6907',
      recoveryEmail: '',
      totpSecret: 'hguzpqh32v3k4wcgnfpv76274iog5ozp',
      link: 'http://umlmail.site/Mail/GetCodeSMS?token=CO1TdgI5Rp06141834'
    });
  });

  it('辅邮缺失且无链接：账号----密码----2fa', () => {
    const r = parseAccountLine('a@gmail.com----Pass@123----JBSWY3DPEHPK3PXP');
    expect(r).toEqual({
      email: 'a@gmail.com',
      googlePassword: 'Pass@123',
      recoveryEmail: '',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      link: undefined
    });
  });

  it('有辅邮但无链接：账号----密码----辅邮----2fa', () => {
    const r = parseAccountLine('a@gmail.com----Pass1----recovery@outlook.com----JBSWY3DPEHPK3PXP');
    expect(r).toEqual({
      email: 'a@gmail.com',
      googlePassword: 'Pass1',
      recoveryEmail: 'recovery@outlook.com',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      link: undefined
    });
  });

  it('otpauth:// 形式的 2FA 不会被误判为辅邮', () => {
    const r = parseAccountLine(
      'a@gmail.com----Pass1----otpauth://totp/Google:a@gmail.com?secret=JBSWY3DPEHPK3PXP'
    );
    expect(r?.recoveryEmail).toBe('');
    expect(r?.totpSecret).toBe('otpauth://totp/Google:a@gmail.com?secret=JBSWY3DPEHPK3PXP');
  });

  it('只有账号密码（缺 2fa）返回 null', () => {
    expect(parseAccountLine('a@gmail.com----Pass1')).toBeNull();
  });
});

describe('parseAccountLine — | 卡密格式（邮箱|密码|辅邮|2FA|备份码|国家|手机）', () => {
  it('完整 7 段：备份码/国家/手机进 note', () => {
    const r = parseAccountLine(
      'SchulteRakan@gmail.com|ejxxbzzoqc7|korfbaggioyu689@gmail.com|colw2jtvjwuz5hwnx4mv5icl2mz4b2rk|61610108,84765346,01695650,13482891,37096204,17234100,34225439,07329514,57073428,38019390|Ireland|19373581145'
    );
    expect(r?.email).toBe('SchulteRakan@gmail.com');
    expect(r?.googlePassword).toBe('ejxxbzzoqc7');
    expect(r?.recoveryEmail).toBe('korfbaggioyu689@gmail.com');
    expect(r?.totpSecret).toBe('colw2jtvjwuz5hwnx4mv5icl2mz4b2rk');
    expect(r?.link).toBeUndefined();
    expect(r?.note).toContain('61610108,84765346');
    expect(r?.note).toContain('Ireland');
    expect(r?.note).toContain('19373581145');
    // 三项都带中文标签
    expect(r?.note).toMatch(/备份码[:：]/);
    expect(r?.note).toMatch(/国家[:：]/);
    expect(r?.note).toMatch(/手机[:：]/);
  });

  it('| 格式缺辅邮：邮箱|密码|2FA|备份码|国家|手机', () => {
    const r = parseAccountLine(
      'a@gmail.com|pw123456|colw2jtvjwuz5hwnx4mv5icl2mz4b2rk|11111111,22222222,33333333|US|13800138000'
    );
    expect(r?.recoveryEmail).toBe('');
    expect(r?.totpSecret).toBe('colw2jtvjwuz5hwnx4mv5icl2mz4b2rk');
    expect(r?.note).toMatch(/备份码[:：]/);
    expect(r?.note).toContain('US');
    expect(r?.note).toContain('13800138000');
  });

  it('无 2FA 格式：邮箱|密码|辅邮|国家(空)|手机 → 2FA 空，手机进 note', () => {
    const r = parseAccountLine(
      'SesurajNalam@gmail.com|hpzyzxvvs|topbestsesurajnalam6015@teml.net||17658390228'
    );
    expect(r).not.toBeNull();
    expect(r?.email).toBe('SesurajNalam@gmail.com');
    expect(r?.googlePassword).toBe('hpzyzxvvs');
    expect(r?.recoveryEmail).toBe('topbestsesurajnalam6015@teml.net');
    expect(r?.totpSecret).toBe(''); // 2FA 字段保留但为空
    expect(r?.note).toContain('17658390228');
  });

  it('无 2FA 但有国家：邮箱|密码|辅邮|Ireland|手机', () => {
    const r = parseAccountLine('a@gmail.com|pw|recovery@x.com|Ireland|13800138000');
    expect(r?.totpSecret).toBe('');
    expect(r?.note).toContain('Ireland');
    expect(r?.note).toContain('13800138000');
  });

  it('首段不是邮箱 → 返回 null（防垃圾行）', () => {
    expect(parseAccountLine('乱七八糟|aaa|bbb')).toBeNull();
  });

  it('密码为空段不错位：邮箱||辅邮|2FA（空密码不吞掉辅邮）', () => {
    const r = parseAccountLine('a@gmail.com||rec@x.com|JBSWY3DPEHPK3PXP');
    expect(r?.email).toBe('a@gmail.com');
    expect(r?.googlePassword).toBe(''); // 密码确实为空，而不是把辅邮顶上来当密码
    expect(r?.recoveryEmail).toBe('rec@x.com');
    expect(r?.totpSecret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('| 格式只有 邮箱|密码|辅邮|2FA（无备份码等）：note 为空', () => {
    const r = parseAccountLine(
      'a@gmail.com|pw123456|recovery@outlook.com|colw2jtvjwuz5hwnx4mv5icl2mz4b2rk'
    );
    expect(r?.recoveryEmail).toBe('recovery@outlook.com');
    expect(r?.totpSecret).toBe('colw2jtvjwuz5hwnx4mv5icl2mz4b2rk');
    expect(r?.note).toBeFalsy();
  });
});

describe('parseAccountLine — 空格/Tab 格式', () => {
  it('账号 密码 辅邮 2fa', () => {
    const r = parseAccountLine('a@gmail.com Pass1 recovery@outlook.com JBSWY3DPEHPK3PXP');
    expect(r).toEqual({
      email: 'a@gmail.com',
      googlePassword: 'Pass1',
      recoveryEmail: 'recovery@outlook.com',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      link: undefined
    });
  });

  it('2fa 密钥中间带空格仍归并', () => {
    const r = parseAccountLine('a@gmail.com Pass1 recovery@outlook.com JBSW Y3DP EHPK 3PXP');
    expect(r?.totpSecret).toBe('JBSW Y3DP EHPK 3PXP');
  });

  it('辅邮缺失：账号 密码 2fa', () => {
    const r = parseAccountLine('a@gmail.com Pass1 JBSWY3DPEHPK3PXP');
    expect(r).toEqual({
      email: 'a@gmail.com',
      googlePassword: 'Pass1',
      recoveryEmail: '',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      link: undefined
    });
  });
});

describe('parseAccountLines — 多行', () => {
  it('过滤空行与无效行', () => {
    const txt = [
      'a@gmail.com----P1----JBSWY3DPEHPK3PXP',
      '',
      '   ',
      'b@gmail.com----P2----recovery@x.com----JBSWY3DPEHPK3PXP----http://x.site',
      '乱七八糟'
    ].join('\n');
    const r = parseAccountLines(txt);
    expect(r.map((x) => x.email)).toEqual(['a@gmail.com', 'b@gmail.com']);
  });
});
