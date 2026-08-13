import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        elevated: "var(--elevated)",
        panel: "var(--panel)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        "primary-hover": "var(--primary-hover)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        "accent-soft": "var(--accent-soft)",
        "accent-line": "var(--accent-line)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 12px)",
        "4xl": "calc(var(--radius) + 16px)",
      },
      fontFamily: {
        sans: ["Mona Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Mona Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Fira Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 20px 60px rgba(0, 0, 0, 0.45)",
        glow:
          "0 0 0 1px oklch(0.79 0.165 69 / 0.16), 0 18px 60px oklch(0.79 0.165 69 / 0.12)",
      },
      keyframes: {
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-14px) rotate(2deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.85" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "decrypt-reveal": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        float: "float-slow 9s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        scan: "scan-line 6s linear infinite",
        "decrypt-reveal": "decrypt-reveal 1.5s ease 0.3s both",
      },
    },
  },
  plugins: [],
} satisfies Config;