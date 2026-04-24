/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
    ],
  },
  experimental: {
    // Tree-shake barrel imports so `import { Icon } from "lucide-react"`
    // and similar only pull in what is actually used. Cuts client bundle
    // meaningfully on pages that import many icons.
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
  },
};

export default nextConfig;
