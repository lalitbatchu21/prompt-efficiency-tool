/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: [
    plugin(function ({ addComponents }) {
      addComponents({
        ".glass": {
          "@apply bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl": {}
        }
      });
    })
  ]
};
