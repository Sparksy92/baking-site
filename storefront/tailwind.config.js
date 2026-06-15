/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './config/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        brand:        '#4A5D4E',
        accent:       '#C27D38',
        surface:      '#FDFBF7',
        earth:        '#354E41',
        terracotta:   '#C27D38',
        sage:         '#6B7F5E',
        sand:         '#E8DDD3',
        cream:        '#FDFBF7',
        warm:         '#FAF3EC',
        deep:         '#223229',
        'muted-earth':'#8C7A6B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'earth':    '0 24px 70px -32px rgba(61, 46, 31, 0.35)',
        'earth-sm': '0 14px 32px -24px rgba(61, 46, 31, 0.5)',
      },
      keyframes: {
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in':           'slide-in 0.25s ease-out',
        'fade-up':            'fade-up 0.7s ease-out forwards',
        'fade-up-delay':      'fade-up 0.7s ease-out 0.15s forwards',
        'fade-up-delay-1':    'fade-up 0.7s ease-out 0.15s forwards',
        'fade-up-delay-2':    'fade-up 0.7s ease-out 0.30s forwards',
        'fade-up-delay-3':    'fade-up 0.7s ease-out 0.45s forwards',
        'hero-fade-1': 'fade-slide-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.10s both',
        'hero-fade-2': 'fade-slide-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.25s both',
        'hero-fade-3': 'fade-slide-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.40s both',
        'hero-fade-4': 'fade-slide-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.55s both',
        'hero-fade-5': 'fade-slide-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.70s both',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.deep'),
            a: { color: theme('colors.terracotta') },
            strong: { color: theme('colors.earth') },
            'h1,h2,h3,h4': { color: theme('colors.earth') },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
