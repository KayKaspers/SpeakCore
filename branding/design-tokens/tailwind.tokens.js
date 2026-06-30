/**
 * SpeakCore Design Tokens – Tailwind theme fragment
 * Status: draft v0.2.0 (NDF Step 005B). Quelle: tokens.json
 *
 * Verwendung (in der WebUI):
 *   const speakcoreTokens = require('../../branding/design-tokens/tailwind.tokens.js');
 *   module.exports = { theme: { extend: { ...speakcoreTokens } } };
 *
 * Hinweis: Dies ist Konfiguration/Design-Token, kein produktiver App-Code.
 */
module.exports = {
  colors: {
    'sc-background': '#0B1220',
    'sc-surface': '#111827',
    'sc-surface-raised': '#1A2233',
    'sc-border': '#1F2937',
    'sc-border-strong': '#334155',
    'sc-primary': '#2563EB',
    'sc-primary-hover': '#1D4ED8',
    'sc-accent': '#06B6D4',
    'sc-info': '#38BDF8',
    'sc-success': '#22C55E',
    'sc-warning': '#F59E0B',
    'sc-error': '#EF4444',
    'sc-text-primary': '#F8FAFC',
    'sc-text-secondary': '#94A3B8',
    'sc-text-muted': '#64748B',
    'sc-ring': '#2563EB',
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
    'sc-xl': '1rem',
    'sc-full': '9999px',
  },
  spacing: {
    'sc-1': '0.25rem',
    'sc-2': '0.5rem',
    'sc-3': '0.75rem',
    'sc-4': '1rem',
    'sc-6': '1.5rem',
    'sc-8': '2rem',
  },
  boxShadow: {
    'sc-sm': '0 1px 2px rgba(0, 0, 0, 0.40)',
    'sc-md': '0 4px 12px rgba(0, 0, 0, 0.45)',
    'sc-lg': '0 12px 32px rgba(0, 0, 0, 0.50)',
  },
  zIndex: {
    'sc-base': '0',
    'sc-dropdown': '1000',
    'sc-sticky': '1100',
    'sc-overlay': '1200',
    'sc-modal': '1300',
    'sc-toast': '1400',
  },
  transitionDuration: {
    'sc-fast': '120ms',
    'sc-base': '200ms',
    'sc-slow': '320ms',
  },
  transitionTimingFunction: {
    'sc-standard': 'cubic-bezier(0.2, 0, 0, 1)',
    'sc-emphasized': 'cubic-bezier(0.3, 0, 0, 1)',
  },
};
