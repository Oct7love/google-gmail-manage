/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: '#fafafa',
        sidebar: '#f0f0f0',
        border: '#e5e5e5',
        text: '#1a1a1a',
        muted: '#888888',
        accent: '#2563eb',
        danger: '#dc2626',
        success: '#059669',
        warning: '#d97706',
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
    },
  },
  plugins: [],
};
