/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure native modules work with Next.js
  serverExternalPackages: ['better-sqlite3', 'ccxt'],
  
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
