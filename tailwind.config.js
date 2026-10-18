/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#16213E',
        gold: '#C9A227',
        goldink: '#7A5A16',
        parchment: '#F5F0E6',
        parchmentline: '#E0D6BC',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'serif'],
        label: ['Montserrat', 'sans-serif'],
        body: ['Lato', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
