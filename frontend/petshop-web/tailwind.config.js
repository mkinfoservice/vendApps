/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7c5cf8",
          hover: "#6d4fe8",
          light: "#a78bfa",
          muted: "rgba(124,92,248,0.12)",
        },
        surface: {
          DEFAULT: "#131929",
          2: "#1a2236",
          3: "#222d45",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
