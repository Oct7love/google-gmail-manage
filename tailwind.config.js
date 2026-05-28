/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // 表面层级（CSS 变量驱动，跨主题切换）
        bg:            'rgb(var(--c-bg) / <alpha-value>)',
        surface:       'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2':   'rgb(var(--c-surface-2) / <alpha-value>)',
        sidebar:       'rgb(var(--c-sidebar) / <alpha-value>)',
        // 边框
        border:        'rgb(var(--c-border) / <alpha-value>)',
        'border-strong':'rgb(var(--c-border-strong) / <alpha-value>)',
        // 文字
        text:          'rgb(var(--c-text) / <alpha-value>)',
        'text-2':      'rgb(var(--c-text-2) / <alpha-value>)',
        muted:         'rgb(var(--c-muted) / <alpha-value>)',
        'muted-2':     'rgb(var(--c-muted-2) / <alpha-value>)',
        // 强调
        accent:        'rgb(var(--c-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        // 语义色（跨主题统一，不进变量）
        danger:  '#ff3b30',
        success: '#34c759',
        warning: '#ff9500',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: '11px',
        sm: '12.5px',
        base: '13.5px',
        lg: '15px',
        xl: '17px',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)',
        'card-hover': '0 2px 6px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
        popover: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};
