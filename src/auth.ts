export type AuthSession = {
  uid: string
  displayName: string
  email: string | null
  kind: 'google' | 'guest'
  idToken: string | null
  refreshToken: string | null
  expiresAt: number | null
}

export type PresenceSession = {
  uid: string
  sessionId: string
  displayName: string
  email: string | null
  kind: 'google' | 'guest'
  online: boolean
  lastSeen: number
}

export type PresenceTree = Record<string, Record<string, PresenceSession>>

const SESSION_KEY = 'lifelink.auth.session.v1'
const GUEST_UID_KEY = 'lifelink.guest.uid.v1'
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? ''
const databaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim().replace(/\/+$/, '') ?? ''
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() ?? ''

type FirebaseTokenResponse = {
  localId?: string
  idToken?: string
  refreshToken?: string
  expiresIn?: string
  email?: string
  displayName?: string
  error?: { message?: string }
}

export const hasFirebaseConfig = Boolean(apiKey && databaseUrl)
export const hasGoogleConfig = Boolean(hasFirebaseConfig && googleClientId)
export const hasPresenceConfig = Boolean(hasFirebaseConfig && adminEmail)

function apiError(data: FirebaseTokenResponse, response: Response) {
  return data.error?.message ?? `Authentication request failed (${response.status}).`
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & FirebaseTokenResponse
  if (!response.ok) throw new Error(apiError(data, response))
  return data
}

function createSession(
  data: FirebaseTokenResponse,
  kind: AuthSession['kind'],
): AuthSession {
  if (!data.localId || !data.idToken || !data.refreshToken) {
    throw new Error('Authentication provider returned an incomplete session.')
  }
  return {
    uid: data.localId,
    displayName: data.displayName?.trim() || (kind === 'guest' ? `Guest ${data.localId.slice(0, 6)}` : 'Google user'),
    email: data.email ?? null,
    kind,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn ?? 3600) * 1000,
  }
}

export function restoreSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    const invalidIdentity =
      !session ||
      typeof session.uid !== 'string' ||
      typeof session.displayName !== 'string' ||
      !['google', 'guest'].includes(session.kind)
    const localGuest =
      !invalidIdentity &&
      session.kind === 'guest' &&
      session.idToken === null &&
      session.refreshToken === null
    const firebaseSession =
      !invalidIdentity &&
      typeof session.idToken === 'string' &&
      typeof session.refreshToken === 'string' &&
      typeof session.expiresAt === 'number'
    if (localGuest || firebaseSession) {
      return session
    }
    window.sessionStorage.removeItem(SESSION_KEY)
    return null
  } catch (error) {
    console.warn('Saved sign-in session could not be restored.', error)
    window.sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  if (
    !session.refreshToken ||
    !session.expiresAt ||
    session.expiresAt - Date.now() > 5 * 60 * 1000
  ) {
    return session
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  })
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  )
  const result = await readJson<{
    id_token?: string
    refresh_token?: string
    expires_in?: string
    user_id?: string
  }>(response)
  if (!result.id_token || !result.user_id) {
    throw new Error('Session refresh returned an incomplete token.')
  }
  const refreshed: AuthSession = {
    ...session,
    uid: result.user_id,
    idToken: result.id_token,
    refreshToken: result.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000,
  }
  persistSession(refreshed)
  return refreshed
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(SESSION_KEY)
}

export function persistSession(session: AuthSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function isLocalSession(session: AuthSession) {
  return session.idToken === null
}

export function isAdminSession(session: AuthSession) {
  return Boolean(adminEmail && session.email?.toLowerCase() === adminEmail)
}

export function getGoogleClientId() {
  return googleClientId
}

export async function signInAsGuest(): Promise<AuthSession> {
  if (hasFirebaseConfig) {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      },
    )
    const result = await readJson<FirebaseTokenResponse>(response)
    const session = createSession(result, 'guest')
    persistSession(session)
    return session
  }

  let uid = window.localStorage.getItem(GUEST_UID_KEY)
  if (!uid) {
    uid = `guest-${crypto.randomUUID()}`
    window.localStorage.setItem(GUEST_UID_KEY, uid)
  }
  const session: AuthSession = {
    uid,
    displayName: `Guest ${uid.slice(-6).toUpperCase()}`,
    email: null,
    kind: 'guest',
    idToken: null,
    refreshToken: null,
    expiresAt: null,
  }
  persistSession(session)
  return session
}

export async function signInWithGoogleCredential(credential: string): Promise<AuthSession> {
  if (!hasGoogleConfig) throw new Error('Google sign-in has not been configured for this site yet.')
  const postBody = new URLSearchParams({
    id_token: credential,
    providerId: 'google.com',
  })
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: postBody.toString(),
        requestUri: window.location.origin,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    },
  )
  const result = await readJson<FirebaseTokenResponse>(response)
  const session = createSession(result, 'google')
  persistSession(session)
  return session
}

export function signOut() {
  window.sessionStorage.removeItem(SESSION_KEY)
}

function presenceUrl(path: string, token: string) {
  if (!databaseUrl) throw new Error('Realtime sign-in monitoring is not configured.')
  return `${databaseUrl}/${path}.json?auth=${encodeURIComponent(token)}`
}

export function makePresenceSession(session: AuthSession): PresenceSession {
  return {
    uid: session.uid,
    sessionId: crypto.randomUUID(),
    displayName: session.displayName,
    email: session.email,
    kind: session.kind,
    online: true,
    lastSeen: Date.now(),
  }
}

export async function writePresence(
  session: AuthSession,
  presence: PresenceSession,
  keepalive = false,
) {
  if (!session.idToken) return
  const response = await fetch(
    presenceUrl(`presence/${encodeURIComponent(session.uid)}/${encodeURIComponent(presence.sessionId)}`, session.idToken),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...presence, lastSeen: Date.now() }),
      keepalive,
    },
  )
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Could not update online status (${response.status}): ${message}`)
  }
}

export function subscribeToPresence(
  token: string,
  onChange: (tree: PresenceTree) => void,
  onStatus: (status: 'connected' | 'reconnecting' | 'error') => void,
) {
  const stream = new EventSource(`${presenceUrl('presence', token)}&print=silent`)
  let tree: PresenceTree = {}
  stream.onopen = () => onStatus('connected')
  stream.onerror = () => onStatus('reconnecting')

  const handleEvent = (event: MessageEvent<string>, eventType: 'put' | 'patch') => {
    try {
      const update = JSON.parse(event.data) as { path?: string; data?: unknown }
      const path = update.path ?? '/'
      if (path === '/') {
        if (eventType === 'put') {
          tree = (update.data as PresenceTree | null) ?? {}
        } else if (update.data && typeof update.data === 'object' && !Array.isArray(update.data)) {
          Object.entries(update.data as Record<string, unknown>).forEach(([uid, sessions]) => {
            if (sessions === null) delete tree[uid]
            else if (sessions && typeof sessions === 'object' && !Array.isArray(sessions)) {
              const currentSessions = tree[uid] ?? {}
              Object.entries(sessions as Record<string, PresenceSession | null>).forEach(([sessionId, presence]) => {
                if (presence === null) delete currentSessions[sessionId]
                else currentSessions[sessionId] = presence
              })
              tree[uid] = currentSessions
            }
          })
        }
      } else if (path.split('/').filter(Boolean).length === 1) {
        const uid = path.split('/')[1]
        if (!uid) return
        if (update.data === null) delete tree[uid]
        else if (eventType === 'patch' && update.data && typeof update.data === 'object' && !Array.isArray(update.data)) {
          const sessions = tree[uid] ?? {}
          Object.entries(update.data as Record<string, PresenceSession | null>).forEach(([sessionId, presence]) => {
            if (presence === null) delete sessions[sessionId]
            else sessions[sessionId] = presence
          })
          tree[uid] = sessions
        } else tree[uid] = update.data as Record<string, PresenceSession>
      } else {
        const [, uid, sessionId] = path.split('/')
        if (!uid || !sessionId) return
        if (!tree[uid]) tree[uid] = {}
        if (update.data === null) delete tree[uid][sessionId]
        else tree[uid][sessionId] = update.data as PresenceSession
      }
      onChange(Object.fromEntries(
        Object.entries(tree).map(([uid, sessions]) => [uid, { ...sessions }]),
      ))
    } catch (error) {
      console.error('Realtime access update could not be processed.', error)
    }
  }
  stream.addEventListener('put', (event) => handleEvent(event as MessageEvent<string>, 'put'))
  stream.addEventListener('patch', (event) => handleEvent(event as MessageEvent<string>, 'patch'))
  stream.addEventListener('cancel', () => onStatus('error'))
  stream.addEventListener('auth_revoked', () => onStatus('error'))
  return () => stream.close()
}

export function deletePresence(session: AuthSession, presence: PresenceSession) {
  if (!session.idToken) return
  void removePresenceEntry(session, session.uid, presence.sessionId).catch((error: unknown) => {
    console.warn('Online status will expire from the admin view after its heartbeat if clean-up fails.', error)
  })
}

export async function removePresenceEntry(session: AuthSession, uid: string, sessionId: string) {
  if (!session.idToken) return
  const request = new Request(
    presenceUrl(`presence/${encodeURIComponent(uid)}/${encodeURIComponent(sessionId)}`, session.idToken),
    { method: 'DELETE', keepalive: true },
  )
  const response = await fetch(request)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Could not clear stale online status (${response.status}): ${message}`)
  }
}
