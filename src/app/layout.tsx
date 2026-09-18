import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { HavenDataProvider } from '@/components/data-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Haven | Care compliance',
  description: 'CQC compliance and quality oversight for UK care homes'
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <HavenDataProvider>{children}</HavenDataProvider>
      </body>
    </html>
  )
}
