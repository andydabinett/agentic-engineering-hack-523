import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Brand surface palette
        canvas: "hsl(var(--canvas))",
        ink: "hsl(var(--ink))",
        "ink-muted": "hsl(var(--ink-muted))",
        "ink-faint": "hsl(var(--ink-faint))",
        rule: "hsl(var(--rule))",
        "rule-strong": "hsl(var(--rule-strong))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          ink: "hsl(var(--accent-ink))",
          soft: "hsl(var(--accent-soft))",
          deep: "hsl(var(--accent-deep))",
        },
        signal: {
          green: "hsl(var(--signal-green))",
          "green-soft": "hsl(var(--signal-green-soft))",
          amber: "hsl(var(--signal-amber))",
          "amber-soft": "hsl(var(--signal-amber-soft))",
          blue: "hsl(var(--signal-blue))",
          "blue-soft": "hsl(var(--signal-blue-soft))",
          purple: "hsl(var(--signal-purple))",
          "purple-soft": "hsl(var(--signal-purple-soft))",
          gray: "hsl(var(--signal-gray))",
          "gray-soft": "hsl(var(--signal-gray-soft))",
          red: "hsl(var(--signal-red))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 hsl(var(--signal-green) / 0.45)" },
          "70%": { boxShadow: "0 0 0 6px hsl(var(--signal-green) / 0)" },
          "100%": { boxShadow: "0 0 0 0 hsl(var(--signal-green) / 0)" },
        },
        "gradient-glow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-right": "slide-in-right 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "gradient-glow": "gradient-glow 3.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
