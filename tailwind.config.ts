import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--background)",
          secondary: "var(--background-secondary)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          hover: "var(--surface-hover)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          muted: "var(--primary-muted)",
        },
        foreground: {
          DEFAULT: "var(--foreground)",
          muted: "var(--muted-foreground)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },
        success: {
          DEFAULT: "var(--success)",
          surface: "var(--success-surface)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          surface: "var(--warning-surface)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          surface: "var(--danger-surface)",
        },
        gold: {
          300: "#E2C17F",
          400: "#D4AF65",
          500: "#C49E52",
          600: "#A98746",
          700: "#8C6E33",
        },
        graphite: {
          700: "#292D35",
          800: "#1D2129",
          850: "#171A20",
          900: "#111318",
          950: "#090A0C",
        },
        glass: {
          DEFAULT: "var(--glass-bg)",
          hover: "var(--glass-bg-hover)",
          subtle: "var(--glass-bg-subtle)",
          border: "var(--glass-border)",
          "border-hover": "var(--glass-border-hover)",
          "border-gold": "var(--glass-border-gold)",
        },
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      boxShadow: {
        glass: "var(--glass-inner-shadow)",
        "glass-elevated": "var(--glass-inner-shadow), 0 12px 30px -10px rgba(0, 0, 0, 0.6)",
        "gold-glow": "0 0 24px -4px rgba(212, 175, 101, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
