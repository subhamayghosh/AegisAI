/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surfaceAlt: "rgb(var(--color-surface-alt) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        textMuted: "rgb(var(--color-text-muted) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        primaryHover: "rgb(var(--color-primary-hover) / <alpha-value>)",
        allow: "rgb(var(--color-allow) / <alpha-value>)",
        allowBg: "rgb(var(--color-allow-bg) / <alpha-value>)",
        neutralize: "rgb(var(--color-neutralize) / <alpha-value>)",
        neutralizeBg: "rgb(var(--color-neutralize-bg) / <alpha-value>)",
        block: "rgb(var(--color-block) / <alpha-value>)",
        blockBg: "rgb(var(--color-block-bg) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};
