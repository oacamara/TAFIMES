import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'TAFIMES MES – Gestion de Production',
  description: 'Manufacturing Execution System pour usine agroalimentaire',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#333', color: '#fff' },
            success: { style: { background: '#15803d', color: '#fff' } },
            error: { style: { background: '#b91c1c', color: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
