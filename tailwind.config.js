/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // make sure these match where your pages/components live
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:     'var(--background-color)',
        text:   'var(--text-color)',
        accent: 'var(--accent-color)',
      },
      spacing: {
        navbar:   'var(--navbar-height)',
        'sidebar-expanded':  'var(--sidebar-expanded)',
        'sidebar-collapsed': 'var(--sidebar-collapsed)',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      height: theme => ({
        navbar: theme('spacing.navbar'),
      }),
      width: theme => ({
        'sidebar-expanded':  theme('spacing.sidebar-expanded'),
        'sidebar-collapsed': theme('spacing.sidebar-collapsed'),
      }),
    },
  },
  plugins: [
    // ← add the aspect‑ratio plugin first
    require('@tailwindcss/aspect-ratio'),

    // your custom scroll‑snap utilities
    function ({ addUtilities }) {
      addUtilities({
        '.scroll‑snap‑y': { 'scroll-snap-type': 'y mandatory' },
        '.snap‑start':    { 'scroll-snap-align': 'start' },
      });
    },
  ],
};
