/** 「上号时间」分段输入的年/月/日/时四格值（都是字符串，允许中途为空）。 */
export interface Seg {
  y: string;
  mo: string;
  d: string;
  h: string;
}

export const EMPTY_SEG: Seg = { y: '', mo: '', d: '', h: '' };

export function tsToSeg(ts: number | null): Seg {
  if (ts == null) return EMPTY_SEG;
  const dt = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return {
    y: String(dt.getFullYear()),
    mo: pad(dt.getMonth() + 1),
    d: pad(dt.getDate()),
    h: pad(dt.getHours()),
  };
}

/** 年/月/日都齐且日期合法时才返回时间戳；否则 null（不提交半成品）。小时留空按 0 点算。 */
export function segToTs(s: Seg): number | null {
  if (!s.y || !s.mo || !s.d) return null;
  const y = Number(s.y);
  const mo = Number(s.mo);
  const d = Number(s.d);
  const h = s.h ? Number(s.h) : 0;
  if (y < 1970 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23) return null;
  const dt = new Date(y, mo - 1, d, h, 0, 0, 0);
  // 回环校验，挡掉 2 月 30 日这类非法组合
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.getTime();
}

/** 四格是否全空。 */
export function isEmptySeg(s: Seg): boolean {
  return !s.y && !s.mo && !s.d && !s.h;
}
