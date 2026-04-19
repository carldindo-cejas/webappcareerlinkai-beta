/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FBF8F2',
          100: '#F5F1EA',
          200: '#ECE6DA',
          300: '#DDD5C4'
        },
        forest: {
          50: '#E8EFEB',
          100: '#C5D4CB',
          200: '#8FA89A',
          400: '#4F7766',
          600: '#2D5A48',
          700: '#1F4D3F',
          900: '#0F2E25'
        },
        terracotta: {
          100: '#F2D9CC',
          400: '#D88B6A',
          600: '#C56A4A',
          800: '#8C3F22'
        },
        ink: {
          100: '#D4CFC2',
          300: '#A8A296',
          500: '#6B665C',
          700: '#3D3A33',
          900: '#1A1814'
        },
        gold: { 500: '#B8924A' }
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '14px',
        xl: '22px'
      },
      boxShadow: {
        sm: '0 1px 2px rgba(31,77,63,0.04), 0 1px 3px rgba(31,77,63,0.06)',
        DEFAULT: '0 4px 12px rgba(31,77,63,0.06), 0 2px 4px rgba(31,77,63,0.04)',
        lg: '0 12px 32px rgba(31,77,63,0.10), 0 4px 8px rgba(31,77,63,0.05)'
      },
      transitionTimingFunction: {
        quiet: 'cubic-bezier(0.22, 1, 0.36, 1)',
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  plugins: []
};
