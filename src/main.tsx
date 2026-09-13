import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

const CANONICAL_HOST = 'www.fieldworkbybaker.com'
const VERCEL_HOST = 'fieldwork-by-baker-testing.vercel.app'
const EMILY_EMAIL = 'ayalaemily52@gmail.com'
const OWNER_EMAIL = 'justin@bakerholdings.co'
const USER_KEY = 'authUser'
const TOKEN_KEY = 'bakerSessionToken'

function redirectToCanonicalHost(): boolean {
  if (window.location.hostname !== VERCEL_HOST) return false
  const target = new URL(window.location.href)
  target.protocol = 'https:'
  target.host = CANONICAL_HOST
  window.location.replace(target.toString())
  return true
}

function storedReservedBetaEmail(): string | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { email?: string }
    const email = String(parsed.email || '').trim().toLowerCase()
    return email === EMILY_EMAIL || email === OWNER_EMAIL ? email : null
  } catch {
    return null
  }
}

function clearBrokenSessionAndReturnToImport(email: string | null): void {
  try {
    if (email) window.sessionStorage.setItem('bakerRefreshEmail', email)
    window.sessionStorage.setItem('bakerReturnAfterLogin', '/import')
    window.localStorage.removeItem(USER_KEY)
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Navigation below still gives the user a clean authentication path.
  }
  window.location.replace('/login?reason=session-refresh&return=%2Fimport')
}

function installMigrationSessionGuard(): void {
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (...args: Parameters<typeof window.fetch>): Promise<Response> => {
    const response = await nativeFetch(...args)
    const input = args[0]
    const requestUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    if (!requestUrl.includes('/api/import-fieldwork') || (response.status !== 401 && response.status !== 403)) {
      return response
    }

    try {
      const payload = await response.clone().json() as { code?: string; error?: string }
      const betaEmail = storedReservedBetaEmail()
      const staleSession = payload.code === 'SESSION_REFRESH_REQUIRED'
      const misleadingLegacyPaywall = Boolean(
        betaEmail && (
          payload.code === 'PAID_REQUIRED' ||
          /paid\s+Baker\s+account\s+is\s+required/i.test(String(payload.error || ''))
        )
      )

      if (staleSession || misleadingLegacyPaywall) {
        window.setTimeout(() => clearBrokenSessionAndReturnToImport(betaEmail), 0)
      }
    } catch {
      // Preserve the original API response if it was not JSON.
    }

    return response
  }
}

if (!redirectToCanonicalHost()) {
  installMigrationSessionGuard()

  createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}
