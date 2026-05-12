import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['degular', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['mr-eaves-sans', 'Georgia', 'serif'],
        mono:  ['var(--font-geist-mono)', 'Menlo', 'monospace'],
      },
      colors: {
        app: "var(--bg-app)",
        sidebar: "var(--bg-sidebar)",
        hover: "var(--bg-hover)",
        background: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        accent: "var(--accent)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        glass: {
          fill: "var(--glass-fill)",
          hover: "var(--glass-hover)",
          border: "var(--glass-border)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        panel: "0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255, 255, 255, 0.06) inset",
        float: "0 16px 48px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08) inset",
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '-250px -250px' },
        },
        'shimmer-gold': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typewriter: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        }
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        'shimmer-gold': 'shimmer-gold 2s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        reveal: 'reveal 0.4s ease-out forwards',
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        slideUp: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        typewriter: 'typewriter 2s steps(40, end) forwards',
      }
    },
  },
  plugins: [typography],
};
export default config;
