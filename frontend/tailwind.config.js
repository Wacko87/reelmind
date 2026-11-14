/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--theme-bg)',
          surface: 'var(--theme-surface)',
          elevated: 'var(--theme-elevated)',
          border: 'var(--theme-border)',
          borderSubtle: 'var(--theme-border-subtle)',
          text: 'var(--theme-text)',
          textMuted: 'var(--theme-text-muted)',
          accent: 'var(--theme-accent)',
          accentHover: 'var(--theme-accent-hover)',
          accentSubtle: 'var(--theme-accent-subtle)',
          accentBorder: 'var(--theme-accent-border)',
        },
        // Compatibilidad con clases anteriores
        claude: {
          bg: 'var(--theme-bg)',
          surface: 'var(--theme-surface)',
          elevated: 'var(--theme-elevated)',
          border: 'var(--theme-border)',
          borderSubtle: 'var(--theme-border-subtle)',
          text: 'var(--theme-text)',
          textMuted: 'var(--theme-text-muted)',
          accent: 'var(--theme-accent)',
          accentHover: 'var(--theme-accent-hover)',
          accentSubtle: 'var(--theme-accent-subtle)',
          accentBorder: 'var(--theme-accent-border)',
        }
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
