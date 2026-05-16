/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        note: "0 12px 25px rgba(0, 0, 0, 0.18)",
        soft: "0 10px 30px rgba(25, 32, 56, 0.15)",
      },
    },
  },
  plugins: [],
};
