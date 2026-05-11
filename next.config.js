/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xjbzfqgkkxmsiqrfqehc.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
