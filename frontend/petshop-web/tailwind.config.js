/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#C8953A",
          hover: "#A87830",
          light: "#E8B56A",
          muted: "rgba(200,149,58,0.14)",
        },
        surface: {
          DEFAULT: "#FAF7F2",
          2: "#F5EDE0",
          3: "#EDE0CC",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
