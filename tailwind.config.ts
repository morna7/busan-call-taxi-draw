import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#b8dcff",
          500: "#1f7ae0",
          600: "#1767c3",
          700: "#15539e",
          800: "#123f79",
          900: "#102f58"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        card: "0 14px 40px rgba(15, 23, 42, 0.10)",
        lift: "0 18px 55px rgba(23, 103, 195, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
