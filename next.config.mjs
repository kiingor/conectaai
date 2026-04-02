/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/supabase-proxy/:path*',
        destination: 'http://82.25.64.199:8000/:path*',
      },
    ]
  },
}

export default nextConfig
