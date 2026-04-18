/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        volt:     '#D4FF3E',
        'volt-dim': '#B8E032',
        energy:   '#FF6B2B',
        'energy-dim': '#E55A1F',
        partner:  '#0A5ADB',
        'partner-dim': '#083C92',
        ice:      '#7EDCFF',
        bg: {
          base:     '#090B0F',
          surface:  '#0F1218',
          elevated: '#161B24',
          overlay:  '#1E2533',
          input:    '#131820',
        },
        text: {
          primary:   '#F2F4F8',
          secondary: '#8E97A8',
          tertiary:  '#5A6272',
        },
      },
      fontFamily: {
        display: ['Cabinet Grotesk', 'var(--font-cabinet)', 'sans-serif'],
        body:    ['Outfit', 'var(--font-outfit)', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        volt:      '0 0 24px rgba(212,255,62,0.2), 0 0 64px rgba(212,255,62,0.08)',
        energy:    '0 0 24px rgba(255,107,43,0.2)',
        card:      '0 8px 32px rgba(0,0,0,0.5)',
        'volt-lg': '0 0 48px rgba(212,255,62,0.3), 0 0 120px rgba(212,255,62,0.12)',
      },
      animation: {
        'orb-float':   'orbFloat 16s ease-in-out infinite',
        'orb-float-2': 'orbFloat2 20s ease-in-out infinite',
        'orb-float-3': 'orbFloat3 12s ease-in-out infinite',
        'marquee':     'marquee 30s linear infinite',
        'pulse-volt':  'pulseVolt 2s ease-in-out infinite',
        'fade-in':     'fadeIn 0.5s ease-out forwards',
        'slide-up':    'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        orbFloat: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%':      { transform: 'translateY(-20px) translateX(10px)' },
          '66%':      { transform: 'translateY(10px) translateX(-10px)' },
        },
        orbFloat2: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%':      { transform: 'translateY(20px) translateX(-15px)' },
        },
        orbFloat3: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-15px)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseVolt: {
          '0%, 100%': { boxShadow: '0 0 24px rgba(212,255,62,0.2)' },
          '50%':      { boxShadow: '0 0 48px rgba(212,255,62,0.4), 0 0 80px rgba(212,255,62,0.15)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'volt-gradient': 'linear-gradient(135deg, #D4FF3E 0%, #a8d400 100%)',
        'hero-gradient': 'radial-gradient(ellipse at 60% 0%, rgba(212,255,62,0.08) 0%, transparent 60%), radial-gradient(ellipse at 0% 60%, rgba(255,107,43,0.06) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
};
