/** @type {import('tailwindcss').Config} */

const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: colors.purple,
        secondary: colors.sky,
      },
      fontFamily: {
        sans: ["'Inter'", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
  darkMode: "class",
};