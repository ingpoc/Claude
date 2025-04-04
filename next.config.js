/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['placeholder.com'],
  },
  webpack: (config, { isServer }) => {
    // Fixes problem with database drivers that include native node addons, like KuzuDB:
    // Exclude kuzu's native module from Webpack bundling on the server.
    // It will be resolved at runtime directly from node_modules.
    if (isServer) {
      config.externals = [...config.externals, 'kuzu'];
    }

    // Important: return the modified config
    return config;
  },
}

module.exports = nextConfig