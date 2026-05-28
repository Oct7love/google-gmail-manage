/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // 表面层级（米白系，Notion 风温暖）
        bg: '#faf9f7',
        surface: '#ffffff',
        'surface-2': '#fdfcfa',
        sidebar: '#f3f1ec',
        // 边框（暖灰）
        border: '#e8e5df',
        'border-strong': '#d6d2c9',
        // 文字
        text: '#1d1d1f',
        'text-2': '#3c3c3f',
        muted: '#6e6e72',
        'muted-2': '#8e8e93',
        // 强调（Linear / Vercel 同款靛蓝）
        accent: '#4f46e5',
        'accent-soft': '#eef2ff',
        // 语义
        danger: '#ff3b30',
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
