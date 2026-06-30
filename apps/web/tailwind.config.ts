import type { Config } from 'tailwindcss';
// Single Source of Truth: SpeakCore Branding Design Tokens (NDF Step 001).
import speakcoreTokens from '../../branding/design-tokens/tailwind.tokens.js';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: speakcoreTokens.colors,
      fontFamily: speakcoreTokens.fontFamily,
      fontSize: speakcoreTokens.fontSize,
      borderRadius: speakcoreTokens.borderRadius,
      spacing: speakcoreTokens.spacing,
      boxShadow: speakcoreTokens.boxShadow,
      zIndex: speakcoreTokens.zIndex,
      transitionDuration: speakcoreTokens.transitionDuration,
      transitionTimingFunction: speakcoreTokens.transitionTimingFunction,
    },
  },
  plugins: [],
};

export default config;
