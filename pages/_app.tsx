import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { AuthProvider } from '../lib/useAuth'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places`}
          strategy="afterInteractive"
        />
      )}
      <Component {...pageProps} />
    </AuthProvider>
  )
}
