import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '旅行スケジュールプランナー',
  description: '飛行機とホテルの情報から最適な観光スケジュールを作成します',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
