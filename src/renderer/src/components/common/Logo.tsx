/**
 * 应用自定义 Logo：带渐变的信封 + 右上角小圆点（代表多账号/未读）。
 */
interface Props {
  size?: number;
}

export default function Logo({ size = 20 }: Props): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mv-logo-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect x="3" y="7" width="26" height="19" rx="3.5" fill="url(#mv-logo-g)" />
      <path
        d="M5 10.5 L16 18 L27 10.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* 右上角小圆点（通知/多账号标识） */}
      <circle cx="25" cy="7" r="4" fill="#F97316" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
