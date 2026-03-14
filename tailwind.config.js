/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"PT Serif"', 'Georgia', 'serif'],
        display: ['"Gilda Display"', '"PT Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
