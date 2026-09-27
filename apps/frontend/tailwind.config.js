/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--canvas)',
        surface: 'var(--surface)',
        elevated: 'var(--surface-soft)',
        accent: {
          primary: 'var(--accent)',
          secondary: 'var(--accent-text)',
          glow: 'transparent',
        },
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
        txt: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
        },
        borderSubtle: 'rgba(255, 255, 255, 0.06)',
        borderHover: 'rgba(255, 255, 255, 0.12)',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        hero: [
          '56px',
          { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '800' },
        ],
        h1: [
          '40px',
          { lineHeight: '1.12', letterSpacing: '-0.025em', fontWeight: '700' },
        ],
        h2: [
          '28px',
          { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        h3: [
          '22px',
          { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' },
        ],
        'body-lg': ['18px', { lineHeight: '1.5', fontWeight: '500' }],
        body: ['15px', { lineHeight: '1.5', fontWeight: '400' }],
        small: ['13px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      maxWidth: {
        container: '1600px',
      },
      boxShadow: {
        subtle: '0 4px 20px rgba(0, 0, 0, 0.5)',
        'accent-glow': 'none',
      },
    },
  },
  plugins: [],
};
