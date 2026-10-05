import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  CloudRain,
  Crosshair,
  Flame,
  HeartPulse,
  Layers,
  LifeBuoy,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Siren,
  Truck,
  Users,
  X,
} from 'lucide-react'
import * as L from 'leaflet'
import type { LucideIcon } from 'lucide-react'
import { emergencyServices, regions, regionalHospitals, sampleIncidents } from './data/demo'
import type { Incident, MapLocation, WeatherData } from './types'
import {
  clearAuthSession,
  getGoogleClientId,
  hasFirebaseConfig,
  hasGoogleConfig,
  hasPresenceConfig,
  isAdminSession,
  isLocalSession,
  makePresenceSession,
  refreshSession,
  removePresenceEntry,
  restoreSession,
  signInAsGuest,
  signInWithGoogleCredential,
  signOut,
  subscribeToPresence,
  writePresence,
  deletePresence,
} from './auth'
import type { AuthSession, PresenceSession, PresenceTree } from './auth'
import './App.css'

const STORAGE_KEY = 'lifelink.community-reports.v1'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'

const navigation: { label: Page; icon: LucideIcon }[] = [
  { label: 'Dashboard', icon: Activity },
  { label: 'Intelligence', icon: Layers },
  { label: 'Emergency', icon: Siren },
  { label: 'Report', icon: Plus },
  { label: 'Community', icon: Users },
]

type Page = 'Dashboard' | 'Intelligence' | 'Emergency' | 'Report' | 'Community'
type WeatherState = 'loading' | 'ready' | 'error'
type SosState = 'idle' | 'holding' | 'active'

function readReports(): Incident[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(
      (report): report is Incident =>
        typeof report === 'object' &&
        report !== null &&
        'id' in report &&
        typeof report.id === 'string' &&
        'title' in report &&
        typeof report.title === 'string' &&
        'location' in report &&
        typeof report.location === 'string' &&
        'description' in report &&
        typeof report.description === 'string' &&
        'category' in report &&
        typeof report.category === 'string' &&
        'time' in report &&
        typeof report.time === 'string' &&
        'severity' in report &&
        ['High', 'Medium', 'Low'].includes(String(report.severity)) &&
        'lat' in report &&
        typeof report.lat === 'number' &&
        Number.isFinite(report.lat) &&
        'lon' in report &&
        typeof report.lon === 'number' &&
        Number.isFinite(report.lon) &&
        'source' in report &&
        report.source === 'Community' &&
        (!('image' in report) || typeof report.image === 'string'),
    )
  } catch (error) {
    console.warn('Saved LifeLink reports could not be read.', error)
    return []
  }

  async function continueAsGuest() {
    setAuthBusy(true)
    setAuthError('')
    try {
      setAuthSession(await signInAsGuest())
    } catch (error) {
      console.error('Guest sign-in failed.', error)
      setAuthError(error instanceof Error ? error.message : 'Guest access could not be started.')
    } finally {
      setAuthBusy(false)
    }
  }

  function leaveAccount() {
    signOut()
    setAuthSession(null)
    setPresenceTree({})
    setPresenceStatus('offline')
    setActivePage('Dashboard')
    setAuthError('')
  }
}

function formatCoordinates(lat: number, lon: number) {
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return escaped[character]
  })
}

function weatherDescription(code: number) {
  if (code === 0) return 'Clear sky'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 67) return 'Rain showers'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorms'
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} days ago`
}

function MapView({
  location,
  selectedRegion,
  incidents,
  satellite,
  expanded = false,
}: {
  location: MapLocation | null
  selectedRegion: MapLocation
  incidents: Incident[]
  satellite: boolean
  expanded?: boolean
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return

    const map = L.map(elementRef.current, { zoomControl: false, scrollWheelZoom: true }).setView(
      [selectedRegion.lat, selectedRegion.lon],
      expanded ? 7 : 6,
    )
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map
    markersRef.current = L.layerGroup().addTo(map)
    const resize = () => map.invalidateSize()
    window.addEventListener('resize', resize)
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(elementRef.current)
    const timer = window.setTimeout(resize, 100)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', resize)
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      markersRef.current = null
      tileRef.current = null
    }
  }, [expanded])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const url = satellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const attribution = satellite
      ? 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    if (tileRef.current) map.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(url, { attribution }).addTo(map)
    map.attributionControl.setPrefix(false)
  }, [satellite])

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return
    const map = mapRef.current
    const markers = markersRef.current
    markers.clearLayers()

    incidents.forEach((incident) => {
      const color = incident.severity === 'High' ? '#df6658' : incident.severity === 'Medium' ? '#d99a37' : '#478a6b'
      const marker = L.divIcon({
        className: 'lifelink-map-marker-wrap',
        html: `<span class="lifelink-map-marker" style="--marker-color:${color}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      L.marker([incident.lat, incident.lon], { icon: marker })
        .bindPopup(`<strong>${escapeHtml(incident.title)}</strong><br>${escapeHtml(incident.location)}<br><small>${escapeHtml(incident.severity)} priority · ${incident.source === 'Community' ? 'Community report' : 'Demo marker'}</small>`)
        .addTo(markers)
    })

    regionalHospitals.forEach((hospital) => {
      const marker = L.divIcon({
        className: 'lifelink-map-marker-wrap',
        html: '<span class="lifelink-map-marker" style="--marker-color:#397db0"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      L.marker([hospital.lat, hospital.lon], { icon: marker })
        .bindPopup(`<strong>${escapeHtml(hospital.name)}</strong><br>${escapeHtml(hospital.city)}<br><small>Regional hospital · Confirm availability before travel</small>`)
        .addTo(markers)
    })

    if (location) {
      const marker = L.divIcon({
        className: 'lifelink-map-marker-wrap',
        html: '<span class="lifelink-user-marker"></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      L.marker([location.lat, location.lon], { icon: marker })
        .bindPopup(`<strong>Your location</strong><br>${formatCoordinates(location.lat, location.lon)}`)
        .addTo(markers)
    }

    map.setView(
      [location?.lat ?? selectedRegion.lat, location?.lon ?? selectedRegion.lon],
      location ? 10 : expanded ? 7 : 6,
      { animate: true },
    )
  }, [incidents, location, selectedRegion, expanded])

  return <div className={`leaflet-map ${expanded ? 'leaflet-map-expanded' : ''}`} ref={elementRef} aria-label="Interactive map of Northeast India" role="application" />
}

function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(restoreSession)
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [presenceTree, setPresenceTree] = useState<PresenceTree>({})
  const [presenceStatus, setPresenceStatus] = useState<'connected' | 'reconnecting' | 'error' | 'offline'>('offline')
  const [presenceError, setPresenceError] = useState('')
  const pruningPresenceRef = useRef(new Set<string>())
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const googleCredentialHandler = useRef<(credential: string) => void>(() => {})
  const [activePage, setActivePage] = useState<Page>('Dashboard')
  const [reports, setReports] = useState<Incident[]>(readReports)
  const [query, setQuery] = useState('')
  const [selectedRegion, setSelectedRegion] = useState(regions[0])
  const [location, setLocation] = useState<MapLocation | null>(null)
  const [locationMessage, setLocationMessage] = useState('')
  const [satellite, setSatellite] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherState, setWeatherState] = useState<WeatherState>('loading')
  const [weatherRefresh, setWeatherRefresh] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [sosState, setSosState] = useState<SosState>('idle')
  const [sosCountdown, setSosCountdown] = useState(5)
  const sosCountdownRef = useRef(5)
  const [sosLocation, setSosLocation] = useState<MapLocation | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [formError, setFormError] = useState('')
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  googleCredentialHandler.current = (credential) => {
    setAuthBusy(true)
    setAuthError('')
    void signInWithGoogleCredential(credential)
      .then(setAuthSession)
      .catch((error: unknown) => {
        console.error('Google sign-in failed.', error)
        setAuthError(error instanceof Error ? error.message : 'Google sign-in could not be completed.')
      })
      .finally(() => setAuthBusy(false))
  }

  const incidents = useMemo(() => [...reports, ...sampleIncidents], [reports])
  const filteredIncidents = useMemo(
    () => incidents.filter((incident) =>
      `${incident.title} ${incident.location} ${incident.category}`.toLowerCase().includes(query.trim().toLowerCase()),
    ),
    [incidents, query],
  )

  function notify(message: string) {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3200)
  }

  useEffect(() => () => {
    if (holdTimerRef.current) window.clearInterval(holdTimerRef.current)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    if (authSession || !hasGoogleConfig || !googleButtonRef.current) return
    let cancelled = false
    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: getGoogleClientId(),
        callback: ({ credential }) => googleCredentialHandler.current(credential),
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(320, Math.floor(googleButtonRef.current.clientWidth)),
        logo_alignment: 'left',
      })
    }
    const script = document.getElementById('google-identity-services') as HTMLScriptElement | null
    if (window.google?.accounts?.id) {
      renderGoogleButton()
    } else if (script) {
      script.addEventListener('load', renderGoogleButton, { once: true })
    } else {
      const googleScript = document.createElement('script')
      googleScript.id = 'google-identity-services'
      googleScript.src = 'https://accounts.google.com/gsi/client'
      googleScript.async = true
      googleScript.defer = true
      googleScript.addEventListener('load', renderGoogleButton, { once: true })
      googleScript.addEventListener('error', () => {
        if (!cancelled) setAuthError('Google sign-in could not load. Check your connection and try again.')
      }, { once: true })
      document.head.append(googleScript)
    }
    return () => {
      cancelled = true
    }
  }, [authSession])

  useEffect(() => {
    if (!authSession?.refreshToken) return
    let active = true
    const refresh = () => {
      void refreshSession(authSession).then((session) => {
        if (!active) return
        setPresenceError('')
        if (session !== authSession) setAuthSession(session)
      }).catch((error: unknown) => {
        if (!active) return
        console.error('The saved sign-in session could not be refreshed.', error)
        const message = error instanceof Error ? error.message : ''
        if (/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND/.test(message)) {
          clearAuthSession()
          setAuthSession(null)
          setAuthError('Your sign-in session expired. Please sign in again.')
        } else {
          setPresenceError('Session renewal failed. Check your connection; LifeLink will retry automatically.')
        }
      })
    }
    refresh()
    const timer = window.setInterval(refresh, 60 * 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [authSession])

  useEffect(() => {
    if (!authSession?.idToken || isLocalSession(authSession) || !hasFirebaseConfig) {
      setPresenceStatus('offline')
      setPresenceTree({})
      return
    }
    let active = true
    const presence: PresenceSession = makePresenceSession(authSession)
    setPresenceError('')
    const heartbeat = () => {
      void writePresence(authSession, presence)
        .then(() => setPresenceError(''))
        .catch((error: unknown) => {
          if (!active) return
          console.error('Could not publish online status.', error)
          setPresenceError('Online status could not be saved. Check your Realtime Database rules.')
        })
    }
    heartbeat()
    const heartbeatTimer = window.setInterval(heartbeat, 30 * 1000)
    const removePresence = () => deletePresence(authSession, presence)
    window.addEventListener('pagehide', removePresence)
    let unsubscribe = () => {}
    if (isAdminSession(authSession) && hasPresenceConfig) {
      setPresenceStatus('reconnecting')
      unsubscribe = subscribeToPresence(
        authSession.idToken,
        (tree) => {
          setPresenceTree(tree)
          const now = Date.now()
          Object.entries(tree).forEach(([uid, sessions]) => {
            Object.values(sessions).forEach((entry) => {
              if (entry.online && now - entry.lastSeen <= 75_000) return
              const key = `${uid}/${entry.sessionId}`
              if (pruningPresenceRef.current.has(key)) return
              pruningPresenceRef.current.add(key)
              void removePresenceEntry(authSession, uid, entry.sessionId).catch((error: unknown) => {
                console.warn('A stale online session could not be removed.', error)
                setPresenceError('A stale online session could not be removed. Check the admin database rules.')
              })
            })
          })
        },
        setPresenceStatus,
      )
    }
    return () => {
      active = false
      window.clearInterval(heartbeatTimer)
      window.removeEventListener('pagehide', removePresence)
      unsubscribe()
      removePresence()
    }
  }, [authSession])

  useEffect(() => {
    const refreshTimer = window.setInterval(() => setWeatherRefresh((current) => current + 1), 15 * 60 * 1000)
    return () => window.clearInterval(refreshTimer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setWeatherState('loading')
    const params = new URLSearchParams({
      latitude: String(selectedRegion.lat),
      longitude: String(selectedRegion.lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
      timezone: 'auto',
    })
    fetch(`${WEATHER_URL}?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Weather service returned ${response.status}`)
        return response.json() as Promise<{
          current?: {
            temperature_2m?: number
            apparent_temperature?: number
            relative_humidity_2m?: number
            precipitation?: number
            weather_code?: number
            wind_speed_10m?: number
            time?: string
          }
        }>
      })
      .then((data) => {
        const current = data.current
        if (!current || current.temperature_2m === undefined || current.weather_code === undefined) {
          throw new Error('Weather response did not contain current conditions.')
        }
        setWeather({
          temperature: Math.round(current.temperature_2m),
          apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
          humidity: current.relative_humidity_2m ?? 0,
          precipitation: current.precipitation ?? 0,
          wind: Math.round(current.wind_speed_10m ?? 0),
          description: weatherDescription(current.weather_code),
          updatedAt: current.time ?? '',
        })
        setWeatherState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Could not load current weather conditions.', error)
        setWeatherState('error')
      })
    return () => controller.abort()
  }, [selectedRegion, weatherRefresh])

  function changePage(page: Page) {
    setActivePage(page)
    setMobileNavOpen(false)
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. Choose a region from the list.')
      return
    }
    setLocationMessage('Requesting your location…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detected = {
          name: 'Current location',
          state: 'Northeast India',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }
        setLocation(detected)
        setLocationMessage(`Location found · ${formatCoordinates(detected.lat, detected.lon)}`)
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Choose a region manually or allow location access in your browser.'
            : error.code === error.TIMEOUT
              ? 'Location lookup timed out. Try again or choose a region manually.'
              : 'Current location could not be determined. Choose a region manually.'
        setLocationMessage(message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function beginSosHold() {
    if (sosState === 'active' || holdTimerRef.current) return
    setSosState('holding')
    sosCountdownRef.current = 5
    setSosCountdown(5)
    holdTimerRef.current = window.setInterval(() => {
      sosCountdownRef.current -= 1
      setSosCountdown(sosCountdownRef.current)
      if (sosCountdownRef.current <= 0) {
        if (holdTimerRef.current) window.clearInterval(holdTimerRef.current)
        holdTimerRef.current = null
        setSosState('active')
        setSosLocation(location ?? selectedRegion)
      }
    }, 1000)
  }

  function startSosHold(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    beginSosHold()
  }

  function cancelSosHold() {
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
      setSosState('idle')
      setSosCountdown(5)
      notify('SOS hold cancelled.')
    }
  }

  function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const reportLocation = String(form.get('location') ?? '').trim()
    const category = String(form.get('category') ?? 'Other')
    const severityValue = String(form.get('severity') ?? 'Medium')
    if (!title || !description || !reportLocation) {
      setFormError('Add an incident type, description and location.')
      return
    }
    const severity: Incident['severity'] =
      severityValue === 'High' || severityValue === 'Low' ? severityValue : 'Medium'
    const report: Incident = {
      id: `LL-${Date.now()}`,
      title,
      description,
      location: reportLocation,
      time: new Date().toISOString(),
      severity,
      category,
      lat: location?.lat ?? selectedRegion.lat,
      lon: location?.lon ?? selectedRegion.lon,
      source: 'Community',
      ...(imagePreview ? { image: imagePreview } : {}),
    }
    const nextReports = [report, ...reports]
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReports))
    } catch (error) {
      console.error('Could not save this report in browser storage.', error)
      setFormError('This report could not be saved on this device. Try a smaller photo or clear browser storage.')
      return
    }
    setReports(nextReports)
    setImagePreview('')
    event.currentTarget.reset()
    notify('Report saved on this device and added to the community feed.')
    changePage('Community')
  }

  function previewImage(file?: File) {
    if (!file) {
      setImagePreview('')
      return
    }
    if (!file.type.startsWith('image/')) {
      setFormError('Choose an image file.')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setFormError('Choose an image under 6 MB.')
      return
    }
    setFormError('')
    createImageBitmap(file)
      .then((bitmap) => {
        const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Image preview could not be created.')
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        setImagePreview(canvas.toDataURL('image/jpeg', 0.72))
      })
      .catch((error: unknown) => {
        console.error('Could not preview the selected image.', error)
        setFormError('This image could not be previewed. Try a different image.')
      })
  }

  const pageTitle: Record<Page, string> = {
    Dashboard: `Welcome, ${authSession?.displayName ?? 'friend'}`,
    Intelligence: 'Location intelligence',
    Emergency: 'Emergency services',
    Report: 'Report an incident',
    Community: 'Community updates',
  }
  const pageDescription: Record<Page, string> = {
    Dashboard: 'Regional response at a glance for Northeast India.',
    Intelligence: 'Explore response activity and field conditions across the eight northeastern states.',
    Emergency: 'Public emergency numbers and the LifeLink SOS demo.',
    Report: 'Share a local incident with your community.',
    Community: 'Community reports saved on this device.',
  }

  const onSosPointerDown = (event: PointerEvent<HTMLButtonElement>) => startSosHold(event)

  if (!authSession) {
    return (
      <SignInScreen
        buttonRef={googleButtonRef}
        error={authError}
        busy={authBusy}
        onGuest={() => void continueAsGuest()}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#dashboard" onClick={() => changePage('Dashboard')} aria-label="LifeLink dashboard">
          <span className="brand-mark"><LifeBuoy size={23} strokeWidth={2.4} /></span>
          <span className="brand-name">life<span>link</span><small>NORTHEAST RESPONSE</small></span>
        </a>
        <div className="workspace-label">REGIONAL WORKSPACE</div>
        <button className="workspace-switcher" onClick={() => changePage('Intelligence')}>
          <span className="workspace-avatar">NE</span>
          <span className="workspace-copy"><strong>Northeast India</strong><small>8 states · Regional network</small></span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">RESPONSE NETWORK</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${activePage === label ? 'nav-active' : ''}`} key={label} onClick={() => changePage(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Community' && reports.length > 0 && <span className="nav-count">{reports.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="on-call-card"><span className="on-call-icon"><ShieldCheck size={17} /></span><div><strong>Demo environment</strong><small>{isLocalSession(authSession) ? 'Local-only guest session' : 'Sample response data'}</small></div><span className="demo-status-dot" /></div>
          <div className="profile">
            <span className="profile-avatar">{authSession.displayName.slice(0, 2).toUpperCase()}</span>
            <span className="profile-copy"><strong>{authSession.displayName}</strong><small>{authSession.email ?? (isLocalSession(authSession) ? 'Local guest ID' : 'Guest account')}</small></span>
            <button className="sign-out-button" onClick={leaveAccount} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>LifeLink</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports…" aria-label="Search incidents and reports" /><kbd>⌘ K</kbd></label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
              {notificationsOpen && <div className="notification-popover"><strong>Regional updates</strong><p><span className="notification-dot-inline" /> Sample incident markers are illustrative.</p><p><span className="notification-dot-inline muted" /> Weather updates use a public forecast API.</p></div>}
            </div>
            <span className="topbar-divider" /><span className="today-label demo-label"><span className="demo-status-dot" /> {isLocalSession(authSession) ? 'Local guest' : 'Demo workspace'}</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> NORTHEAST INDIA <span className="eyebrow-separator">·</span> 8 STATES</div><h1>{pageTitle[activePage]}<span className="wave">✳</span></h1><p className="page-subtitle">{pageDescription[activePage]}</p></div>
            {activePage !== 'Report' && <button className="primary-button" onClick={() => changePage('Report')}><Plus size={17} /> Report an incident</button>}
          </section>
          {presenceError && <p className="presence-alert" role="status">{presenceError}</p>}

          {activePage === 'Dashboard' && (
            <>
              <section className="stat-grid" aria-label="Regional response overview">
                <StatCard label="Active reports" value={String(incidents.length).padStart(2, '0')} delta="Across the demo region" icon={Siren} tone="coral" trend="up" />
                <StatCard label="Call-for-help lines" value="03" delta="Direct call links" icon={Truck} tone="violet" trend="up" />
                <StatCard label="Community reports" value={String(reports.length).padStart(2, '0')} delta="Saved on this device" icon={Users} tone="mint" trend="up" />
                <StatCard label="Weather updates" value={weatherState === 'ready' ? 'Live' : '—'} delta={weatherState === 'ready' ? 'Open-Meteo forecast' : 'Checking connection'} icon={CloudRain} tone="amber" trend="down" />
              </section>
              <section className="main-grid">
                <MapPanel location={location} selectedRegion={selectedRegion} incidents={incidents} satellite={satellite} setSatellite={setSatellite} onLocate={requestLocation} onOpenMap={() => changePage('Intelligence')} />
                <WeatherPanel weather={weather} state={weatherState} location={selectedRegion} refresh={() => setWeatherRefresh((current) => current + 1)} />
              </section>
              <section className="bottom-grid">
                <IncidentList incidents={filteredIncidents.slice(0, 4)} title="Recent reports" onViewAll={() => changePage('Community')} />
                <SosCard state={sosState} countdown={sosCountdown} start={onSosPointerDown} cancel={cancelSosHold} begin={beginSosHold} />
              </section>
              <EmergencyStrip onOpen={() => changePage('Emergency')} />
              {isAdminSession(authSession) && (
                <OnlineVisitorsPanel
                  tree={presenceTree}
                  status={presenceStatus}
                  message={presenceError}
                  configured={hasPresenceConfig}
                />
              )}
            </>
          )}

          {activePage === 'Intelligence' && (
            <section className="intelligence-layout">
              <div className="panel intelligence-map-panel">
                <div className="panel-heading"><div><div className="panel-kicker">NORTHEAST INDIA · INTERACTIVE MAP</div><h2>Regional response map <span className="live-pill"><span /> MAP</span></h2></div><button className={`map-mode-button ${satellite ? 'map-mode-active' : ''}`} onClick={() => setSatellite((value) => !value)}><Layers size={15} /> {satellite ? 'Satellite' : 'Street'} view</button></div>
                <div className="map-toolbar">
                  <label className="region-select"><MapPin size={15} /><select value={selectedRegion.name} onChange={(event) => { const next = regions.find((region) => region.name === event.target.value); if (next) { setSelectedRegion(next); setLocation(null) } }} aria-label="Choose a region">{regions.map((region, index) => <option key={`${region.name}-${index}`} value={region.name}>{region.name}</option>)}</select><ChevronDown size={14} /></label>
                  <button className="map-tool" onClick={requestLocation}><Crosshair size={15} /> My location</button>
                  <span className="map-api-label"><span className="online-dot" /> Interactive map · OpenStreetMap</span>
                </div>
                <MapView location={location} selectedRegion={selectedRegion} incidents={incidents} satellite={satellite} expanded />
                <div className="map-footer"><span><span className="legend-dot dot-high" /> High priority</span><span><span className="legend-dot dot-medium" /> Medium</span><span><span className="legend-dot dot-team" /> Community</span><span><span className="legend-dot dot-service" /> Hospitals</span><span className="map-attribution-note">Satellite imagery is not live video; incident pins are demo/community reports.</span></div>
                {locationMessage && <p className="location-message">{locationMessage}</p>}
              </div>
              <aside className="intelligence-side">
                <div className="panel region-panel"><div className="panel-kicker">SELECTED REGION</div><h2>{location?.name ?? selectedRegion.name}</h2><p><MapPin size={14} /> {location ? formatCoordinates(location.lat, location.lon) : `${selectedRegion.state} · Northeast India`}</p><button className="outline-button" onClick={requestLocation}><Navigation size={15} /> Detect my location</button>{locationMessage && <div className="location-message">{locationMessage}</div>}</div>
                <WeatherPanel weather={weather} state={weatherState} location={selectedRegion} refresh={() => setWeatherRefresh((current) => current + 1)} compact />
                <IncidentList incidents={filteredIncidents.slice(0, 3)} title={`Reports nearby · ${filteredIncidents.length}`} onViewAll={() => changePage('Community')} compact />
              </aside>
            </section>
          )}

          {activePage === 'Emergency' && (
            <>
              <SosCard state={sosState} countdown={sosCountdown} start={onSosPointerDown} cancel={cancelSosHold} begin={beginSosHold} featured />
              <div className="section-heading"><div><div className="panel-kicker">INDIA EMERGENCY CONTACTS</div><h2>Call for help</h2><p>These are public emergency numbers. Availability may vary by state and mobile network.</p></div></div>
              <section className="service-grid">{emergencyServices.map(({ name, detail, number, icon, tint }) => { const Icon = icon === 'ambulance' ? HeartPulse : icon === 'fire' ? Flame : ShieldCheck; return <article className="service-card" key={number}><span className={`service-icon service-${tint}`}><Icon size={21} /></span><div><h3>{name}</h3><p>{detail}</p></div><a className="call-button" href={`tel:${number}`}><Phone size={15} /> Call {number}</a></article> })}</section>
              <div className="emergency-note"><ShieldCheck size={18} /><div><strong>Need immediate help?</strong><p>Call 112 for pan-India emergency assistance. This demo app does not contact emergency services or dispatch a responder.</p></div></div>
              <RegionalFacilities />
              <IncidentList incidents={filteredIncidents.slice(0, 4)} title="Regional alerts" onViewAll={() => changePage('Community')} />
            </>
          )}

          {activePage === 'Report' && (
            <ReportForm imagePreview={imagePreview} formError={formError} onImage={previewImage} onSubmit={saveReport} location={location ?? selectedRegion} onLocate={requestLocation} locationMessage={locationMessage} />
          )}

          {activePage === 'Community' && (
            <CommunityFeed incidents={filteredIncidents.filter((incident) => incident.source === 'Community')} query={query} onReport={() => changePage('Report')} />
          )}

          <footer className="page-footer"><span>LifeLink · SIH 2026 presentation demo</span><span>Illustrative incident data · Not a live dispatch system</span><button onClick={() => notify('LifeLink · Northeast India response and logistics demo')}>About LifeLink <ArrowRight size={12} /></button></footer>
        </div>
      </main>

      {sosState === 'active' && <SosModal location={sosLocation} onClose={() => setSosState('idle')} />}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </div>
  )
}

function SignInScreen({
  buttonRef,
  error,
  busy,
  onGuest,
}: {
  buttonRef: { current: HTMLDivElement | null }
  error: string
  busy: boolean
  onGuest: () => void
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <a className="brand auth-brand" href="#signin" aria-label="LifeLink">
          <span className="brand-mark"><LifeBuoy size={23} strokeWidth={2.4} /></span>
          <span className="brand-name">life<span>link</span><small>NORTHEAST RESPONSE</small></span>
        </a>
        <div className="auth-orbit" aria-hidden="true"><span /><span /><LifeBuoy size={31} /></div>
        <div className="panel-kicker">NORTHEAST INDIA · RESPONSE NETWORK</div>
        <h1>Help starts with being connected.</h1>
        <p className="auth-intro">Sign in to explore regional intelligence, share community reports, and reach emergency resources.</p>
        {hasGoogleConfig ? (
          <div className={`google-button-wrap ${busy ? 'auth-busy' : ''}`} ref={buttonRef} />
        ) : (
          <div className="auth-setup-note"><ShieldCheck size={17} /><span>Google sign-in becomes available when this site is connected to its Firebase project.</span></div>
        )}
        <div className="auth-separator"><span>OR</span></div>
        <button className="guest-button" onClick={onGuest} disabled={busy}>
          {busy ? <span className="auth-spinner" /> : <Users size={17} />}
          Continue as a guest
        </button>
        <p className="guest-explanation">
          {hasFirebaseConfig
            ? 'A temporary guest account lets you use the app immediately.'
            : 'Guest mode works now on this browser. Cross-device accounts need Firebase setup.'}
        </p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="auth-footnote"><ShieldCheck size={14} /> LifeLink is a presentation demo. SOS does not dispatch responders.</div>
      </section>
    </main>
  )
}

function OnlineVisitorsPanel({
  tree,
  status,
  message,
  configured,
}: {
  tree: PresenceTree
  status: 'connected' | 'reconnecting' | 'error' | 'offline'
  message: string
  configured: boolean
}) {
  const [, setClock] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const now = Date.now()
  const visitorsByUid = new Map<string, PresenceSession>()
  Object.entries(tree).forEach(([uid, sessions]) => {
    Object.values(sessions)
      .filter((session) => session.online && now - session.lastSeen < 75_000)
      .sort((first, second) => second.lastSeen - first.lastSeen)
      .slice(0, 1)
      .forEach((session) => visitorsByUid.set(uid, session))
  })
  const visitors = [...visitorsByUid.values()]
    .sort((first, second) => second.lastSeen - first.lastSeen)

  return (
    <section className="panel visitors-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-kicker">ADMIN VIEW · FIREBASE REALTIME DATABASE</div>
          <h2>Active visitors <span className={`visitor-connection ${status}`}><span /> {status === 'connected' ? 'LIVE' : status === 'error' ? 'CHECK ACCESS' : 'CONNECTING'}</span></h2>
        </div>
        <div className="visitor-count"><Users size={15} /> {visitors.length}</div>
      </div>
      {!configured ? (
        <p className="visitor-note">Add the Firebase database URL and admin email to this site’s build configuration to enable presence.</p>
      ) : status === 'error' ? (
        <p className="visitor-note">Presence access was denied. Add your signed-in Firebase UID to <code>/admins</code> in the Realtime Database.</p>
      ) : visitors.length === 0 ? (
        <p className="visitor-note">No active visitors yet. Users appear after signing in with Firebase on another browser or device.</p>
      ) : (
        <div className="visitor-list">
          {visitors.map((visitor) => (
            <div className="visitor-row" key={`${visitor.uid}/${visitor.sessionId}`}>
              <span className="visitor-avatar">{visitor.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="visitor-copy"><strong>{visitor.displayName}</strong><small>{visitor.email ?? 'Guest account'} · {visitor.kind === 'google' ? 'Google' : 'Guest'}</small></span>
              <span className="visitor-online"><span /> Online</span>
            </div>
          ))}
        </div>
      )}
      {message && <p className="visitor-warning">{message}</p>}
    </section>
  )
}

function StatCard({ label, value, delta, icon: Icon, tone, trend }: { label: string; value: string; delta: string; icon: LucideIcon; tone: string; trend: 'up' | 'down' }) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon icon-${tone}`}><Icon size={17} /></span></div><div className="stat-value">{value}</div><div className="stat-bottom"><span className="trend-icon"><TrendIcon size={13} /></span>{delta}</div></article>
}

function MapPanel({ location, selectedRegion, incidents, satellite, setSatellite, onLocate, onOpenMap }: {
  location: MapLocation | null
  selectedRegion: MapLocation
  incidents: Incident[]
  satellite: boolean
  setSatellite: (value: boolean) => void
  onLocate: () => void
  onOpenMap: () => void
}) {
  return <div className="panel map-panel"><div className="panel-heading"><div><div className="panel-kicker">REGIONAL INTELLIGENCE</div><h2>Response map <span className="live-pill"><span /> INTERACTIVE</span></h2></div><button className="subtle-button" onClick={onOpenMap}>Explore map <ArrowUpRight size={15} /></button></div><div className="map-wrap"><div className="map-top-tools"><button className="map-tool" onClick={() => setSatellite(!satellite)}><Layers size={15} /> {satellite ? 'Satellite' : 'Street'}</button><button className="map-tool map-locate" onClick={onLocate} aria-label="Show my location"><Crosshair size={16} /></button></div><MapView location={location} selectedRegion={selectedRegion} incidents={incidents} satellite={satellite} /></div><div className="map-footer"><span><span className="online-dot" /> OpenStreetMap · Zoom and pan</span><button onClick={onOpenMap}>Open intelligence <ArrowRight size={14} /></button></div></div>
}

function WeatherPanel({ weather, state, location, refresh, compact = false }: { weather: WeatherData | null; state: WeatherState; location: MapLocation; refresh: () => void; compact?: boolean }) {
  return <div className={`panel weather-panel ${compact ? 'weather-compact' : ''}`}><div className="panel-heading"><div><div className="panel-kicker">PUBLIC FORECAST API · OPEN-METEO</div><h2>Local weather</h2></div><button className="icon-button small-icon" onClick={refresh} aria-label="Refresh weather"><Activity size={16} /></button></div><div className="weather-location"><MapPin size={14} /> {location.name} <span className="weather-live-label">{state === 'ready' ? 'LIVE DATA' : state === 'loading' ? 'UPDATING' : 'UNAVAILABLE'}</span></div>{state === 'ready' && weather ? <><div className="weather-main"><div className="weather-temp">{weather.temperature}<span>°</span></div><div className="weather-condition"><CloudRain size={30} /><strong>{weather.description}</strong><span>Feels like {weather.apparentTemperature}°C</span></div></div><div className="weather-stats"><div><span>HUMIDITY</span><strong>{weather.humidity}%</strong></div><div><span>RAINFALL</span><strong>{weather.precipitation}<small> mm</small></strong></div><div><span>WIND</span><strong>{weather.wind}<small> km/h</small></strong></div></div><p className="weather-disclaimer">Current conditions via Open-Meteo. Forecast data is informational, not an official warning.</p></> : <div className={`weather-placeholder ${state === 'error' ? 'weather-error' : ''}`}>{state === 'loading' ? 'Loading current regional conditions…' : 'Weather service is unavailable. Try refreshing or check your connection.'}</div>}</div>
}

function IncidentList({ incidents, title, onViewAll, compact = false }: { incidents: Incident[]; title: string; onViewAll: () => void; compact?: boolean }) {
  return <div className={`panel incidents-panel ${compact ? 'incidents-compact' : ''}`}><div className="panel-heading"><div><div className="panel-kicker">{compact ? 'COMMUNITY SIGNALS' : 'LOCAL AWARENESS'}</div><h2>{title} <span className="heading-count">{incidents.length}</span></h2></div><button className="subtle-button" onClick={onViewAll}>View all <ArrowRight size={14} /></button></div><div className="incident-list">{incidents.length === 0 ? <div className="empty-state">No reports match your search.</div> : incidents.map((incident) => <article className="incident-row" key={incident.id}><span className={`incident-icon incident-${incident.category.toLowerCase()}`}><IncidentIcon category={incident.category} /></span><span className="incident-main"><strong>{incident.title}</strong><small><MapPin size={11} /> {incident.location}</small></span><span className={`priority priority-${incident.severity.toLowerCase()}`}><i />{incident.severity}</span><span className="incident-time"><Clock3 size={12} /> {incident.source === 'Community' ? timeAgo(incident.time) : incident.time}</span></article>)}</div></div>
}

function IncidentIcon({ category }: { category: string }) {
  const Icon = category === 'Flood' || category === 'Weather' ? CloudRain : category === 'Medical' ? HeartPulse : category === 'Fire' ? Flame : category === 'Transport' ? Truck : Siren
  return <Icon size={17} />
}

function SosCard({ state, countdown, start, cancel, begin, featured = false }: { state: SosState; countdown: number; start: (event: PointerEvent<HTMLButtonElement>) => void; cancel: () => void; begin: () => void; featured?: boolean }) {
  return <section className={`sos-card ${featured ? 'sos-card-featured' : ''}`}><div className="sos-copy"><div className="sos-eyebrow"><span className="sos-pulse" /> EMERGENCY ASSISTANCE</div><h2>{featured ? 'Need urgent help?' : 'Emergency? Get help started.'}</h2><p>Press and hold SOS for 5 seconds to open the emergency confirmation screen. Releasing early cancels.</p><small className="sos-disclaimer">Demo workflow only · No alert is sent to responders.</small></div><button className={`sos-hold-button ${state === 'holding' ? 'sos-holding' : ''}`} onPointerDown={start} onPointerUp={cancel} onPointerCancel={cancel} onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); begin() } }} onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') cancel() }} onBlur={cancel} onContextMenu={(event) => event.preventDefault()} aria-label={state === 'holding' ? `Release to cancel, ${countdown} seconds remaining` : 'Press and hold for five seconds to preview SOS'}><Siren size={22} />{state === 'holding' ? <span>Hold… {countdown}</span> : <span>HOLD FOR SOS</span>}</button>{state === 'holding' && <div className="sos-countdown" aria-live="polite"><span>{countdown}</span><div><strong>{countdown} seconds to demo alert</strong><small>Release now to cancel</small></div></div>}</section>
}

function SosModal({ location, onClose }: { location: MapLocation | null; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="sos-modal" role="dialog" aria-modal="true" aria-labelledby="sos-title"><button className="icon-button sos-close" onClick={onClose} aria-label="Close SOS confirmation"><X size={18} /></button><span className="sos-modal-icon"><Siren size={25} /></span><div className="sos-eyebrow">DEMO SOS · NOT DISPATCHED</div><h2 id="sos-title">SOS hold complete</h2><p>This confirms the hold interaction only. No emergency alert or location has been sent to responders.</p><div className="sos-location-box"><MapPin size={16} /><span><strong>{location?.name ?? 'Region not selected'}</strong><small>{location ? formatCoordinates(location.lat, location.lon) : 'Choose a region or allow location access'}</small></span></div><a className="real-call-button" href="tel:112"><Phone size={17} /> Call India emergency number 112</a><button className="cancel-button sos-dismiss" onClick={onClose}>Close demo alert</button><small className="sos-safety-note">For a real emergency in India, call 112 directly. SOS sending requires a connected dispatch service.</small></section></div>
}

function EmergencyStrip({ onOpen }: { onOpen: () => void }) {
  return <div className="emergency-strip"><span className="emergency-strip-icon"><Phone size={16} /></span><span><strong>India emergency helpline</strong><small>Call 112 for police, fire or ambulance assistance</small></span><a href="tel:112" className="emergency-call-link">Call 112 <ArrowRight size={14} /></a><button onClick={onOpen}>More services</button></div>
}

function RegionalFacilities() {
  return <section className="facilities-section"><div className="section-heading"><div><div className="panel-kicker">NORTHEAST INDIA · FACILITY DIRECTORY</div><h2>Regional referral hospitals</h2><p>Confirm routes, service availability and opening information directly with each facility.</p></div></div><div className="facility-list">{regionalHospitals.map((facility) => <article className="facility-card" key={facility.name}><span className="facility-icon"><HeartPulse size={18} /></span><span className="facility-copy"><strong>{facility.name}</strong><small>{facility.city}</small></span><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${facility.name}, ${facility.city}`)}`} target="_blank" rel="noreferrer">Open map <ArrowUpRight size={13} /></a></article>)}</div></section>
}

function ReportForm({ imagePreview, formError, onImage, onSubmit, location, onLocate, locationMessage }: { imagePreview: string; formError: string; onImage: (file?: File) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; location: MapLocation; onLocate: () => void; locationMessage: string }) {
  const [reportLocation, setReportLocation] = useState(location.name)
  useEffect(() => setReportLocation(location.name), [location.name])
  return <section className="panel report-form-panel"><div className="report-intro"><span className="report-icon"><Siren size={21} /></span><div><h2>Share what is happening</h2><p>Your report is stored on this device and appears in the Community feed. It is not sent to emergency services.</p></div></div><form className="report-form" onSubmit={onSubmit}><label>Incident type<select name="category" defaultValue="Flood"><option>Flood</option><option>Medical</option><option>Fire</option><option>Transport</option><option>Weather</option><option>Other</option></select></label><label>Short title<input name="title" required maxLength={90} placeholder="e.g. Road blocked near the bridge" /></label><label className="form-full">Description<textarea name="description" required maxLength={600} rows={4} placeholder="Describe what happened and any immediate risks…" /></label><label>Location<input name="location" required value={reportLocation} onChange={(event) => setReportLocation(event.target.value)} maxLength={120} placeholder="Village, district or landmark" /><button className="inline-location-button" type="button" onClick={onLocate}><Crosshair size={13} /> Use current location</button>{locationMessage && <small className="location-message">{locationMessage}</small>}</label><label>Severity<select name="severity" defaultValue="Medium"><option>High</option><option>Medium</option><option>Low</option></select></label><div className="form-full upload-label"><span>Photo evidence <small>Optional · resized locally before saving</small></span><label className="upload-drop"><input type="file" accept="image/*" onChange={(event) => onImage(event.currentTarget.files?.[0])} /><Plus size={17} /><span>Choose an image under 6 MB</span></label>{imagePreview && <div className="image-preview"><img src={imagePreview} alt="Selected incident preview" /><button type="button" className="icon-button" onClick={() => onImage()} aria-label="Remove photo"><X size={15} /></button></div>}</div>{formError && <div className="form-error" role="alert">{formError}</div>}<div className="report-actions"><span><ShieldCheck size={14} /> Saved locally on this device</span><button className="primary-button" type="submit"><Plus size={16} /> Submit community report</button></div></form></section>
}

function CommunityFeed({ incidents, query, onReport }: { incidents: Incident[]; query: string; onReport: () => void }) {
  return <section className="community-section"><div className="community-toolbar"><div><div className="panel-kicker">COMMUNITY-SUBMITTED · LOCAL DEVICE</div><h2>Neighbourhood reports</h2><p>Only reports submitted from this browser appear here. No shared server is connected.</p></div><button className="primary-button" onClick={onReport}><Plus size={16} /> New report</button></div>{incidents.length === 0 ? <div className="panel community-empty"><span><Users size={22} /></span><h3>{query ? 'No reports match your search' : 'The community feed is ready'}</h3><p>{query ? 'Try another search term.' : 'Reports you submit will appear here and remain available on this device.'}</p>{!query && <button className="outline-button" onClick={onReport}><Plus size={15} /> Submit the first report</button>}</div> : <div className="community-grid">{incidents.map((incident) => <article className="panel community-card" key={incident.id}>{incident.image && <img className="community-image" src={incident.image} alt={`Community report: ${incident.title}`} />}<div className="community-card-top"><span className={`incident-icon incident-${incident.category.toLowerCase()}`}><IncidentIcon category={incident.category} /></span><span className={`priority priority-${incident.severity.toLowerCase()}`}><i />{incident.severity}</span></div><div className="community-category">{incident.category} · Community report</div><h3>{incident.title}</h3><p>{incident.description}</p><div className="community-meta"><span><MapPin size={13} />{incident.location}</span><span><Clock3 size={13} />{timeAgo(incident.time)}</span></div></article>)}</div>}</section>
}

export default App
