import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '竞家数据统计看板',
  description: '数据对比分析看板',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

