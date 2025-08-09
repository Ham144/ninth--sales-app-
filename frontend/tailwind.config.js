// tailwind.config.js

import defaultTheme from "tailwindcss/defaultTheme";
import colors from "tailwindcss/colors";
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette.js"; // note: ESM butuh .js di akhir!

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/flowbite/**/*.js",
  ],

  theme: {
    extend: {
      boxShadow: {
        input: `0px 2px 3px -1px rgba(0,0,0,0.1), 0px 1px 0px 0px rgba(25,28,33,0.02), 0px 0px 0px 1px rgba(25,28,33,0.08)`,
      },
      // tambahkan extend lain dari Aceternity di sini jika perlu
    },
  },

  plugins: [
    require("daisyui"),
    require("tailwindcss-animate"),
    require("flowbite/plugin"),
  ],

  daisyui: {
    themes: ["corporate"],
  },
};
