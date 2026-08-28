import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1115",
        surface: "#171a21",
        "surface-hover": "#1d212a",
        border: "#262b36",
        muted: "#8a8f9c",
        accent: "#6c8cff",
        accent2: "#8f6cff",
        positive: "#4ade80",
        negative: "#f87171",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
