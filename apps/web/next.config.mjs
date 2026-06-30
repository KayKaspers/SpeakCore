import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace-Pakete als TypeScript-Quelle transpilieren (Monorepo).
  transpilePackages: ['@speakcore/types', '@speakcore/shared'],
};

export default withNextIntl(nextConfig);
