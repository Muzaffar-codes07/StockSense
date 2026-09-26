/** @type {import('tailwindcss').Config} */

// StockSense design tokens. Every colour is a CSS variable (RGB channels) defined
// once in src/index.css, so components never hard-code hex values and alpha
// modifiers (bg-sienna/10) keep working.
const token = (name) => `rgb(var(--ss-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        raspberry: token('raspberry'), // #160F0C  rail, deepest anchors
        sienna: {
          DEFAULT: token('sienna'), // #391214  primary actions, brand accents
          hover: token('sienna-hover'),
          press: token('sienna-press'),
        },
        chocolate: token('chocolate'), // #52423D  secondary depth
        moonrock: token('moonrock'), // #887D77  muted UI
        dove: token('dove'), // #C0BAB3  soft surfaces
        // Environment
        canvas: token('canvas'), // #F4F7FA
        surface: token('surface'), // #FFFFFF
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
        },
        ondark: token('ondark'),
        // Semantic (never brand colours)
        success: { DEFAULT: token('success'), fg: token('success-fg') },
        warning: { DEFAULT: token('warning'), fg: token('warning-fg') },
        danger: { DEFAULT: token('danger'), fg: token('danger-fg') },
        info: { DEFAULT: token('info'), fg: token('info-fg') },
        // Analytical support colours (charts only)
        steel: token('steel'),
        forecast: token('forecast'),
        // Legacy alias so any un-migrated `brand-*` class still renders on-brand.
        brand: {
          50: token('dove'),
          500: token('sienna'),
          600: token('sienna'),
          700: token('sienna-hover'),
        },
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        display: ['32px', { lineHeight: '38px', letterSpacing: '-0.03em', fontWeight: '700' }],
        title: ['20px', { lineHeight: '26px', letterSpacing: '-0.02em', fontWeight: '650' }],
        kpi: ['30px', { lineHeight: '34px', letterSpacing: '-0.035em', fontWeight: '700' }],
        meta: ['12px', { lineHeight: '16px' }],
      },
      borderRadius: {
        shell: '32px',
        panel: '26px',
        card: '22px',
        'card-sm': '18px',
        control: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(22 15 12 / 0.04), 0 10px 30px rgb(22 15 12 / 0.05)',
        lift: '0 2px 4px rgb(22 15 12 / 0.05), 0 16px 40px rgb(22 15 12 / 0.09)',
        glass: '0 16px 50px rgb(22 15 12 / 0.07)',
        pop: '0 24px 64px rgb(22 15 12 / 0.20)',
        focus: '0 0 0 4px rgb(57 18 20 / 0.12)',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-in': {
          from: { opacity: '0.4', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'pop-in': 'pop-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'sheet-in': 'sheet-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'toast-in': 'toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
