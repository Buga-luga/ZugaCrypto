/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    PORT: 3001
  },
  experimental: {
    swcMinify: true,
  },
}

module.exports = nextConfig