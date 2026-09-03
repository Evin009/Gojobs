/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // One accent, used sparingly — a developer tool reads as serious when
        // colour marks the live thing and nothing else.
        ink: {
          950: "#08080a",
          900: "#0e0e12",
          800: "#16161c",
          700: "#22222b",
          600: "#33333f",
          400: "#6b6b7b",
          300: "#9a9aad",
          100: "#e8e8ef",
        },
        acid: {
          DEFAULT: "#c8ff3d",
          dim: "#9fd420",
        },
      },
      fontFamily: {
        mono: ["Berkeley Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      keyframes: {
        // a slow sweep across the accent rule, so the panel never feels dead
        sweep: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        sweep: "sweep 3.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
