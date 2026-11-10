/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  darkMode: 'class', // enable dark mode via a .dark class on <html> or <body>
  theme: {
    extend: {
      colors: {
        // Reference CSS variables so the design can be themed dynamically.
        background: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        primary: 'var(--color-primary)',
        accent: 'var(--color-accent)',
      },
    },
  },
  plugins: [],
};
