import { describe, it, expect } from 'vitest';
import { segToTs, tsToSeg, isEmptySeg, EMPTY_SEG } from './startedAtDate';

describe('segToTs', () => {
  it('年月日不全 → null（不提交半成品）', () => {
    expect(segToTs({ y: '2026', mo: '', d: '', h: '' })).toBeNull();
    expect(segToTs({ y: '2026', mo: '06', d: '', h: '' })).toBeNull();
  });

  it('合法日期 → 时间戳，小时留空按 0 点', () => {
    const ts = segToTs({ y: '2026', mo: '06', d: '15', h: '' });
    expect(ts).not.toBeNull();
    const d = new Date(ts as number);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 6, 15, 0]);
  });

  it('挡掉 2 月 30 日这类非法组合（回环校验）', () => {
    expect(segToTs({ y: '2026', mo: '02', d: '30', h: '' })).toBeNull();
  });

  it('越界的月/时 → null', () => {
    expect(segToTs({ y: '2026', mo: '13', d: '01', h: '' })).toBeNull();
    expect(segToTs({ y: '2026', mo: '06', d: '15', h: '25' })).toBeNull();
  });
});

describe('tsToSeg / isEmptySeg', () => {
  it('null → 全空', () => {
    expect(tsToSeg(null)).toEqual(EMPTY_SEG);
    expect(isEmptySeg(tsToSeg(null))).toBe(true);
  });

  it('tsToSeg 与 segToTs 往返一致（补零）', () => {
    const seg = tsToSeg(new Date(2026, 0, 5, 9, 0, 0, 0).getTime());
    expect(seg).toEqual({ y: '2026', mo: '01', d: '05', h: '09' });
    expect(segToTs(seg)).toBe(new Date(2026, 0, 5, 9, 0, 0, 0).getTime());
  });
});
