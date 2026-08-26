/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optional: proxy /api/* to Crow backend to avoid CORS entirely.
  // Uncomment the rewrites() block below if you prefer same-origin requests
  // instead of direct CORS calls to http://localhost:8080.
  //
  // async rewrites() {
  //   return [
  //     {
  //       source: "/api/:path*",
  //       destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/:path*`,
  //     },
  //   ];
  // },
};

export default nextConfig;
