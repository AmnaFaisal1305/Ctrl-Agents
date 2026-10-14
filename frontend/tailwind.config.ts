import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── shadcn / existing tokens ──
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        danger: { DEFAULT: "hsl(var(--danger))", foreground: "hsl(var(--danger-foreground))", soft: "hsl(var(--danger-soft))" },
        warn: { DEFAULT: "hsl(var(--warn))", foreground: "hsl(var(--warn-foreground))", soft: "hsl(var(--warn-soft))" },
        ok: { DEFAULT: "hsl(var(--ok))", foreground: "hsl(var(--ok-foreground))", soft: "hsl(var(--ok-soft))" },
        // ── new palette tokens ──
        paper: "var(--paper)",
        surface: "var(--surface)",
        rail: "var(--rail)",
        brand: { DEFAULT: "var(--brand)", ink: "var(--brand-ink)", tint: "var(--brand-tint)" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        line: { DEFAULT: "var(--line)", 2: "var(--line-2)" },
        hi: { DEFAULT: "var(--hi)", tint: "var(--hi-tint)" },
        mdcol: { DEFAULT: "var(--md)", bar: "var(--md-bar)", tint: "var(--md-tint)" },
        lo: { DEFAULT: "var(--lo)", tint: "var(--lo-tint)" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["'Instrument Sans'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "slide-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.2s ease-out",
        blink: "blink 1.4s infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
