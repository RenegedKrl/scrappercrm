/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0a0a0a',
          900: '#121212', // Background principal
          800: '#1c1c1c', // Background secundário (cards)
          700: '#2a2a2a', // Hover states
        },
        primary: {
          500: '#10b981', // Verde principal (botões ativos)
          600: '#059669',
        }
      }
    },
  },
  plugins: [],
}
