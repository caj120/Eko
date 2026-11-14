import daisyui from "daisyui";
import typography from "@tailwindcss/typography";
import daisyuiThemes from "daisyui/src/theming/themes";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      title: ["Georgia", "Times New Roman", "serif"],
      serif: ["Georgia", "Times New Roman", "serif"],
      content: ["Inter"],
      mono: ["Space Mono"],
    },
    extend: {},
  },
  plugins: [typography, daisyui],
  daisyui: {
    themes: [
      {
        // Warm editorial: paper, ink, one forest-green accent.
        light: {
          ...daisyuiThemes["[data-theme=light]"],
          primary: "#2F5D50",
          "primary-content": "#FFFCF5",
          secondary: "#8A5A12",
          "secondary-content": "#FFFCF5",
          accent: "#2F5D50",

          "base-100": "#F6F0E4",
          "base-200": "#EBE2D0",
          "base-300": "#B8AA90",
          "base-content": "#2B2620",

          neutral: "#2B2620",
          "neutral-focus": "#4A4238",
          "neutral-content": "#FFFCF5",

          "--rounded-box": "1rem",
          "--rounded-btn": "9999px",
        },
      },
      {
        dark: {
          ...daisyuiThemes["[data-theme=dark]"],
          primary: "#7FB5A3",
          "primary-content": "#14201C",
          secondary: "#D9A441",
          accent: "#7FB5A3",

          "base-100": "#1C1915",
          "base-200": "#2A261F",
          "base-300": "#6B6354",
          "base-content": "#EFE8D8",

          neutral: "#EFE8D8",
          "neutral-focus": "#D8CFBB",
          "neutral-content": "#1C1915",

          "--rounded-box": "1rem",
          "--rounded-btn": "9999px",
        },
      },
    ],
  },
};
