import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        "primary-dim": "var(--primary-dim)",
        "on-primary": "var(--on-primary)",
        catch: "var(--catch)",
        "kinda-bg": "var(--kinda-bg)",
        "kinda-fg": "var(--kinda-fg)",
        "no-bg": "var(--no-bg)",
        "no-fg": "var(--no-fg)",
        "lose-bg": "var(--lose-bg)",
        "lose-border": "var(--lose-border)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        pill: "999px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.22, 1, .36, 1)",
        snap: "cubic-bezier(.2, .9, .3, 1.2)",
      },
      maxWidth: {
        wrap: "1120px",
      },
    },
  },
  plugins: [],
} satisfies Config;
