/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow reading from parent directory for bot data
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
  },
};

export default nextConfig;
