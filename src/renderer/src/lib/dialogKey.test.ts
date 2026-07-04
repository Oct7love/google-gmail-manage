import { describe, it, expect } from 'vitest';
import { dialogInstanceKey } from './dialogKey';

describe('dialogInstanceKey', () => {
  it('关闭态', () => {
    expect(dialogInstanceKey(null)).toBe('closed');
  });
  it('新增态', () => {
    expect(dialogInstanceKey('new')).toBe('new');
  });
  it('切换 update 目标 → 不同 key（强制 remount，防跨账号残留）', () => {
    expect(dialogInstanceKey({ update: 'a@x.com' })).not.toBe(
      dialogInstanceKey({ update: 'b@x.com' }),
    );
  });
  it('new 与 update 的 key 不同', () => {
    expect(dialogInstanceKey('new')).not.toBe(dialogInstanceKey({ update: 'a@x.com' }));
  });
});
