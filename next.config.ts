// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  images: {
    // Replace deprecated `domains` with `remotePatterns`
    remotePatterns: [
      { protocol: 'https', hostname: 'clips.kick.com' },
      { protocol: 'https', hostname: 'files.kick.com' },
      // add more hosts here if you ever load avatars/thumbnails from elsewhere
      // e.g. { protocol: 'https', hostname: 'cdn.yourdomain.com' }
    ],
    // Optional: let Next serve modern formats when possible
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
