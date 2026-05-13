/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "sonner",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-toast",
      "@radix-ui/react-avatar",
    ],
  },
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
