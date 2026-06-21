import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number | null;
  onChange: (ts: number | null) => void;
}

interface Seg {
  y: string;
  mo: string;
  d: string;
  h: string;
}

const EMPTY: Seg = { y: '', mo: '', d: '', h: '' };

function tsToSeg(ts: number | null): Seg {
  if (ts == null) return EMPTY;
  const dt = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return {
    y: String(dt.getFullYear()),
    mo: pad(dt.getMonth() + 1),
    d: pad(dt.getDate()),
    h: pad(dt.getHours()),
  };
}

/** 四格都齐且日期合法时才返回时间戳；否则 null（不提交半成品）。小时留空按 0 点算。 */
function segToTs(s: Seg): number | null {
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

const ORDER = ['y', 'mo', 'd', 'h'] as const;
type Field = (typeof ORDER)[number];
const MAXLEN: Record<Field, number> = { y: 4, mo: 2, d: 2, h: 2 };

/**
 * 自制「上号时间」分段输入：年/月/日/时四个小格子。
 * 年份只收 4 位、填满自动跳到月；月/日/时填满 2 位自动跳下一格；
 * 在空格子按退格回到上一格。比系统原生日期选择器在 Mac 上更顺手。
 */
export default function StartedAtInput({ value, onChange }: Props): JSX.Element {
  const [seg, setSeg] = useState<Seg>(() => tsToSeg(value));
  const lastEmitted = useRef<number | null>(value);

  const yRef = useRef<HTMLInputElement>(null);
  const moRef = useRef<HTMLInputElement>(null);
  const dRef = useRef<HTMLInputElement>(null);
  const hRef = useRef<HTMLInputElement>(null);
  const refs: Record<Field, React.RefObject<HTMLInputElement>> = {
    y: yRef,
    mo: moRef,
    d: dRef,
    h: hRef,
  };

  // 外部改了 value（如菜单「记录上号时间」写入当前时间、或点了清除）时同步回各格
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setSeg(tsToSeg(value));
      lastEmitted.current = value;
    }
  }, [value]);

  function commit(next: Seg): void {
    setSeg(next);
    const ts = segToTs(next);
    if (ts != null) {
      lastEmitted.current = ts;
      onChange(ts);
    } else if (!next.y && !next.mo && !next.d && !next.h) {
      lastEmitted.current = null;
      onChange(null);
    }
  }

  function focusNext(field: Field): void {
    const idx = ORDER.indexOf(field);
    if (idx < ORDER.length - 1) refs[ORDER[idx + 1]].current?.focus();
  }

  function focusPrev(field: Field): void {
    const idx = ORDER.indexOf(field);
    if (idx > 0) refs[ORDER[idx - 1]].current?.focus();
  }

  function handleChange(field: Field, raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, MAXLEN[field]);
    commit({ ...seg, [field]: digits });
    if (digits.length === MAXLEN[field]) focusNext(field);
  }

  function handleKeyDown(field: Field, e: React.KeyboardEvent<HTMLInputElement>): void {
    // 空格子按退格 → 跳回上一格继续删
    if (e.key === 'Backspace' && seg[field] === '') {
      e.preventDefault();
      focusPrev(field);
      return;
    }
    // 用 / - . 空格 当分隔符快速跳下一格
    if (['/', '-', '.', ' '].includes(e.key)) {
      e.preventDefault();
      focusNext(field);
    }
  }

  const inputCls =
    'min-w-0 bg-transparent text-center text-[12px] tabular-nums text-text outline-none placeholder:text-muted-2';
  const sep = <span className="select-none text-muted-2">·</span>;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-md border border-border bg-surface px-2 py-1 transition-colors duration-150 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30">
      <input
        ref={yRef}
        value={seg.y}
        onChange={(e) => handleChange('y', e.target.value)}
        onKeyDown={(e) => handleKeyDown('y', e)}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        placeholder="年"
        className={`${inputCls} w-9`}
        aria-label="年"
      />
      {sep}
      <input
        ref={moRef}
        value={seg.mo}
        onChange={(e) => handleChange('mo', e.target.value)}
        onKeyDown={(e) => handleKeyDown('mo', e)}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        placeholder="月"
        className={`${inputCls} w-6`}
        aria-label="月"
      />
      {sep}
      <input
        ref={dRef}
        value={seg.d}
        onChange={(e) => handleChange('d', e.target.value)}
        onKeyDown={(e) => handleKeyDown('d', e)}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        placeholder="日"
        className={`${inputCls} w-6`}
        aria-label="日"
      />
      {sep}
      <input
        ref={hRef}
        value={seg.h}
        onChange={(e) => handleChange('h', e.target.value)}
        onKeyDown={(e) => handleKeyDown('h', e)}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        placeholder="时"
        className={`${inputCls} w-6`}
        aria-label="时"
      />
      <span className="select-none text-[11px] text-muted-2">点</span>
    </div>
  );
}
