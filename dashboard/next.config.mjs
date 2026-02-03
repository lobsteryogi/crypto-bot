import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root detection
  outputFileTracingRoot: __dirname,
  
  // Ensure native modules work with Next.js
  serverExternalPackages: ['better-sqlite3', 'ccxt'],
  
  // Allow dev requests from external IPs
  allowedDevOrigins: ['http://206.189.159.43:3456'],
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize native modules and ccxt (has complex dependencies)
      config.externals = config.externals || [];
      config.externals.push({
        'better-sqlite3': 'commonjs better-sqlite3',
        'ccxt': 'commonjs ccxt',
      });
    }
    return config;
  },
};

export default nextConfig;
