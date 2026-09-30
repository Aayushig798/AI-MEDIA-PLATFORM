/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Lets a second dev server use its own build folder; two servers sharing .next corrupt it.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;