import { describe, expect, it } from 'vitest';
import { computeMenuPosition } from './menuPosition';

const VIEW = { viewportW: 1000, viewportH: 800, menuW: 176, menuH: 260 };

describe('computeMenuPosition', () => {
  it('opens downward when there is room below', () => {
    // 按钮在顶部附近，下方有大把空间
    const r = { top: 100, bottom: 124, left: 200, right: 230 };
    const pos = computeMenuPosition({ rect: r, ...VIEW });
    expect(pos.openUpward).toBe(false);
    expect(pos.top).toBe(124 + 4); // rect.bottom + gap
  });

  it('flips upward for a row pinned to the bottom of the viewport', () => {
    // 归档列表最底部那一行：下方几乎没有空间
    const r = { top: 760, bottom: 784, left: 200, right: 230 };
    const pos = computeMenuPosition({ rect: r, ...VIEW });
    expect(pos.openUpward).toBe(true);
    // 向上弹时菜单底边贴着按钮上方，整张菜单可见（top >= margin）
    expect(pos.top).toBe(760 - 4 - 260);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  it('right-aligns the menu to the trigger button', () => {
    const r = { top: 100, bottom: 124, left: 400, right: 430 };
    const pos = computeMenuPosition({ rect: r, ...VIEW });
    expect(pos.left).toBe(430 - 176); // rect.right - menuW
  });

  it('clamps left so the menu never goes off the left edge', () => {
    const r = { top: 100, bottom: 124, left: 10, right: 40 };
    const pos = computeMenuPosition({ rect: r, ...VIEW });
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it('keeps an upward menu inside the viewport top', () => {
    // 按钮靠上但下方也不够（极窄视口）：向上弹后仍夹在 margin 内
    const r = { top: 40, bottom: 64, left: 200, right: 230 };
    const pos = computeMenuPosition({ rect: r, viewportW: 1000, viewportH: 120, menuW: 176, menuH: 260 });
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });
});
