/**
 * 根据 email / name 生成一个稳定的圆形头像：首字母 + 确定性背景色。
 * 同一个 email 永远是同一个颜色。
 */

const PALETTE = [
  '#2563eb', // blue
  '#db2777', // pink
  '#059669', // green
  '#d97706', // amber
  '#7c3aed', // purple
  '#dc2626', // red
  '#0891b2', // cyan
  '#65a30d', // lime
  '#c026d3', // fuchsia
  '#ea580c', // orange
];

export function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** 从 email 或 "Name <email>" 中取首字母用于显示 */
export function initialFor(src: string): string {
  const clean = src.replace(/<.*>/, '').trim();
  const ch = clean[0] ?? '?';
  return ch.toUpperCase();
}

/** 从 "Name <xxx@yy.com>" 中取出显示名；没有名字就取邮箱 @ 前部分 */
export function displayNameFor(src: string): string {
  const m = src.match(/^\s*"?([^"<]+?)"?\s*<.+>\s*$/);
  if (m && m[1].trim()) return m[1].trim();
  const emailMatch = src.match(/([^\s<>]+)@/);
  if (emailMatch) return emailMatch[1];
  return src;
}
