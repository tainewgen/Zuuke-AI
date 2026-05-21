import type { Metadata } from 'next'
import { Bebas_Neue, Rajdhani, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Cursor from '@/components/Cursor'

const bebasNeue = Bebas_Neue({
  weight: '400',
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
})

const rajdhani = Rajdhani({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Zuuke — AI PC Build Assistant',
  description: 'Tell Zuuke your budget and use case. Get a complete, compatible, optimized PC build in seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Cursor />
        {children}
      </body>
    </html>
  )
}
