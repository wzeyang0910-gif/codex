/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  experimental: {
    authInterrupts: true
  }
};

export default nextConfig;
