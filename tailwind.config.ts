import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ubuntu: {
          orange: "#E95420",
          "orange-dark": "#C34113",
          "sidebar-dark": "#2C001E",
          "sidebar-alt": "#300A24",
          "topbar": "#1a1a1a",
          "topbar-alt": "#2d2d2d",
          "window-light": "#F5F5F5",
          "window-dark": "#2C2C2C",
          "text-light": "#EEEEEC",
          "text-dark": "#3D3D3D",
          "border-light": "#D4D4D4",
          "border-dark": "#404040",
          "card-light": "#FFFFFF",
          "card-dark": "#383838",
          "row-alt-light": "#F0F0F0",
          "row-alt-dark": "#333333",
          close: "#FF5F57",
          minimize: "#FEBC2E",
          maximize: "#28C840",
        },
      },
      fontFamily: {
        ubuntu: ["Ubuntu", "sans-serif"],
        "ubuntu-mono": ["Ubuntu Mono", "monospace"],
      },
      borderRadius: {
        gnome: "12px",
        "gnome-sm": "8px",
      },
      boxShadow: {
        gnome: "0 2px 8px rgba(0, 0, 0, 0.15)",
        "gnome-lg": "0 4px 16px rgba(0, 0, 0, 0.2)",
      },
      animation: {
        "gnome-spin": "gnome-spin 1s linear infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
      keyframes: {
        "gnome-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
