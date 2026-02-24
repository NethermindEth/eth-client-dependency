import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        text: '#e6edf3',
        muted: '#8b949e',
        el: '#388bfd',
        cl: '#3fb950',
        cross: '#d2a8ff',
        native: '#ffa657',
      },
    },
  },
  plugins: [],
}

export default config
