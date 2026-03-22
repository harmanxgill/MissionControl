import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        hud: {
          bg: "#060a0f",
          surface: "#0b1118",
          border: "#1a2840",
          green: "#00ff87",
          amber: "#ffb800",
          red: "#ff3a3a",
          cyan: "#38c8f0",
          text: "#8faabe",
          dim: "#2e4a5f",
        },
      },
    },
  },
  plugins: [],
};
export default config;
