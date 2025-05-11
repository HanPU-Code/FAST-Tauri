/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // 정적 내보내기 설정
  images: {
    unoptimized: true,
  },
}

export default nextConfig
