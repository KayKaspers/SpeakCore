/**
 * SpeakCore Design Tokens – Tailwind theme fragment
 * Status: draft (NDF Step 001). Quelle: tokens.json
 *
 * Verwendung (später, in der WebUI):
 *   const speakcoreTokens = require('../../branding/design-tokens/tailwind.tokens.js');
 *   module.exports = { theme: { extend: { ...speakcoreTokens } } };
 *
 * Hinweis: Dies ist Konfiguration/Design-Token, kein produktiver App-Code.
 */
module.exports = {
  colors: {
    'sc-background': '#0B1220',
    'sc-surface': '#111827',
    'sc-primary': '#2563EB',
    'sc-accent': '#06B6D4',
    'sc-success': '#22C55E',
    'sc-warning': '#F59E0B',
    'sc-error': '#EF4444',
    'sc-text-primary': '#F8FAFC',
    'sc-text-secondary': '#94A3B8',
  },
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
  },
  fontSize: {
    'sc-display': '2.25rem',
    'sc-h1': '1.5rem',
    'sc-h2': '1.25rem',
    'sc-body': '1rem',
    'sc-sm': '0.875rem',
    'sc-caption': '0.75rem',
  },
  borderRadius: {
    'sc-sm': '0.375rem',
    'sc-md': '0.5rem',
    'sc-lg': '0.75rem',
  },
  spacing: {
    'sc-1': '0.25rem',
    'sc-2': '0.5rem',
    'sc-3': '0.75rem',
    'sc-4': '1rem',
    'sc-6': '1.5rem',
    'sc-8': '2rem',
  },
};
