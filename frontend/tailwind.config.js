/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ED2024', // LarkAI Red
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #ED2024 0%, #7d1113 100%)',
        'app-gradient': 'radial-gradient(900px 520px at 50% 118%, rgba(125, 17, 19, 0.5) 0%, transparent 60%), radial-gradient(1100px 700px at 50% -12%, rgba(59, 8, 9, 0.55) 0%, transparent 55%), linear-gradient(180deg, #0a0506 0%, #060304 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-lg': '0 12px 48px 0 rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
