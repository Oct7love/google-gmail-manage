import { colorForKey, initialFor } from '../../lib/avatar';

interface Props {
  /** 用于派生颜色的 key（email / display name） */
  identityKey: string;
  /** 显示的首字母文本来源（默认用 identityKey） */
  label?: string;
  size?: number;
}

export default function Avatar({ identityKey, label, size = 28 }: Props): JSX.Element {
  const bg = colorForKey(identityKey);
  const ch = initialFor(label ?? identityKey);
  const fontSize = Math.round(size * 0.46);
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white select-none"
    >
      {ch}
    </span>
  );
}
