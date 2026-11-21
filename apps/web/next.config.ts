import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // packages/shared は TypeScript のまま参照する
  transpilePackages: ['@polimoney-ledger/shared'],
};

export default nextConfig;
