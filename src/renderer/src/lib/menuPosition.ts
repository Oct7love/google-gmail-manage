/**
 * 计算「更多操作」下拉菜单的 fixed 定位。
 *
 * 历史 bug：菜单原本用 absolute 渲染在 overflow-y-auto 的账号列表里，
 * 列表最底部那一行的菜单会被滚动区裁掉、被底部「添加账号」按钮挡住，够不到里面的项。
 * 改成 fixed + portal 后，定位用这个纯函数算：右对齐触发按钮，优先向下弹，
 * 下方放不下且上方更宽裕时翻转向上，最后整体夹进视口内。
 */

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MenuPositionInput {
  /** 触发按钮的视口坐标矩形（getBoundingClientRect） */
  rect: Rect;
  viewportW: number;
  viewportH: number;
  /** 菜单宽 / 高（高度可用估计值） */
  menuW: number;
  menuH: number;
  /** 菜单与按钮的间距 */
  gap?: number;
  /** 与视口边缘保留的安全边距 */
  margin?: number;
}

export interface MenuPosition {
  left: number;
  top: number;
  /** 是否向上弹（true=菜单在按钮上方） */
  openUpward: boolean;
}

export function computeMenuPosition({
  rect,
  viewportW,
  viewportH,
  menuW,
  menuH,
  gap = 4,
  margin = 8,
}: MenuPositionInput): MenuPosition {
  const spaceBelow = viewportH - rect.bottom;
  const spaceAbove = rect.top;
  // 下方放不下整张菜单，且上方比下方更宽裕 → 向上弹
  const openUpward = spaceBelow < menuH + gap + margin && spaceAbove > spaceBelow;

  let top = openUpward ? rect.top - gap - menuH : rect.bottom + gap;
  top = clamp(top, margin, viewportH - menuH - margin);

  let left = rect.right - menuW; // 右对齐触发按钮的右边缘
  left = clamp(left, margin, viewportW - menuW - margin);

  return { left, top, openUpward };
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo; // 视口比菜单还小的极端情况：贴上/左边
  return Math.max(lo, Math.min(v, hi));
}
