import { useMemo, useState, type FormEvent } from 'react'
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
  FileText,
  Flame,
  HeartPulse,
  Layers,
  LifeBuoy,
  MapPin,
  Menu,
  MoreHorizontal,
  Navigation,
  Plus,
  Search,
  ShieldCheck,
  Siren,
  Truck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import './App.css'

type Incident = {
  id: string
  title: string
  location: string
  time: string
  status: 'Responding' | 'Dispatched' | 'Monitoring'
  priority: 'High' | 'Medium' | 'Low'
  icon: 'flood' | 'medical' | 'fire'
}

const initialIncidents: Incident[] = [
  { id: 'INC-2048', title: 'Flash flood warning', location: 'Dima Hasao, Assam', time: '2 min ago', status: 'Responding', priority: 'High', icon: 'flood' },
  { id: 'INC-2047', title: 'Medical assistance', location: 'Kohima, Nagaland', time: '14 min ago', status: 'Dispatched', priority: 'Medium', icon: 'medical' },
  { id: 'INC-2046', title: 'Forest fire reported', location: 'West Khasi Hills, Meghalaya', time: '38 min ago', status: 'Monitoring', priority: 'Medium', icon: 'fire' },
]

const navigation = [
  { label: 'Overview', icon: Activity },
  { label: 'Live map', icon: Layers },
  { label: 'Incidents', icon: Siren, count: '08' },
  { label: 'Resources', icon: Truck },
  { label: 'Analytics', icon: FileText },
]

const iconForIncident = {
  flood: CloudRain,
  medical: HeartPulse,
  fire: Flame,
}

function App() {
  const [activePage, setActivePage] = useState('Overview')
  const [incidents, setIncidents] = useState(initialIncidents)
  const [query, setQuery] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState('')

  const filteredIncidents = useMemo(() => {
    const search = query.trim().toLowerCase()
    return search
      ? incidents.filter((incident) =>
          `${incident.title} ${incident.location} ${incident.id}`.toLowerCase().includes(search),
        )
      : incidents
  }, [incidents, query])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') || '').trim()
    const location = String(form.get('location') || '').trim()
    if (!title || !location) {
      notify('Enter an incident type and location.')
      return
    }

    const nextId = `INC-${2049 + incidents.length - initialIncidents.length}`
    const priorityValue = form.get('priority')
    const priority = priorityValue === 'Medium' || priorityValue === 'Low' ? priorityValue : 'High'
    setIncidents((current) => [
      { id: nextId, title, location, time: 'Just now', status: 'Dispatched', priority, icon: 'medical' },
      ...current,
    ])
    setShowReport(false)
    notify('Demo incident added to the incident list.')
  }

  const pageTitle = activePage === 'Overview' ? 'Good morning, Aisha' : activePage
  const pageDescription =
    activePage === 'Overview'
      ? 'Here’s what’s happening across the Northeast today.'
      : `Monitor ${activePage.toLowerCase()} and coordinate regional response.`

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={() => setActivePage('Overview')} aria-label="LifeLink home">
          <span className="brand-mark"><LifeBuoy size={23} strokeWidth={2.4} /></span>
          <span className="brand-name">life<span>link</span><small>RESPONSE NETWORK</small></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switcher" onClick={() => notify('Northeast region selected')}>
          <span className="workspace-avatar">NE</span>
          <span className="workspace-copy"><strong>Northeast Region</strong><small>India · 8 states</small></span>
          <ChevronDown size={15} />
        </button>

        <div className="nav-label">OPERATIONS</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, count }) => (
            <button
              className={`nav-item ${activePage === label ? 'nav-active' : ''}`}
              key={label}
              onClick={() => {
                setActivePage(label)
                setMobileNavOpen(false)
                const targetId: Record<string, string> = {
                  Overview: 'page-top',
                  'Live map': 'response-map',
                  Incidents: 'recent-incidents',
                  Resources: 'response-teams',
                  Analytics: 'regional-stats',
                }
                document.getElementById(targetId[label])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {count && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="nav-label tools-label">TOOLS</div>
        <button className="nav-item" onClick={() => notify('Community directory coming soon')}>
          <Users size={18} strokeWidth={1.8} /><span>Community</span>
        </button>
        <button className="nav-item" onClick={() => notify('Help centre is a demo placeholder')}>
          <LifeBuoy size={18} strokeWidth={1.8} /><span>Help centre</span>
        </button>

        <div className="sidebar-bottom">
          <div className="on-call-card">
            <span className="on-call-icon"><ShieldCheck size={17} /></span>
            <div><strong>Demo environment</strong><small>Sample data only</small></div>
            <span className="online-dot" />
          </div>
          <button className="profile" onClick={() => notify('Demo profile: Aisha Sharma')}>
            <span className="profile-avatar">AS</span>
            <span className="profile-copy"><strong>Aisha Sharma</strong><small>Regional coordinator</small></span>
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>LifeLink</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search incidents..." aria-label="Search incidents" />
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications((visible) => !visible)} aria-label="Notifications">
                <Bell size={18} /><span className="notification-dot" />
              </button>
              {showNotifications && (
                <div className="notification-popover">
                  <strong>Notifications</strong>
                  <p><span className="notification-dot-inline" /> Sample flood alert in Dima Hasao</p>
                  <p><span className="notification-dot-inline muted" /> 2 response teams available in this demo</p>
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <span className="today-label demo-label"><span className="online-dot" /> Demo workspace</span>
          </div>
        </header>

        <div className="page-content" id="page-top">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> MONDAY, OCTOBER 5, 2026</div>
              <h1>{pageTitle}{activePage === 'Overview' && <span className="wave">✳</span>}</h1>
              <p className="page-subtitle">{pageDescription}</p>
            </div>
            <button className="primary-button" onClick={() => setShowReport(true)}><Plus size={17} /> Report an incident</button>
          </section>

          <section className="stat-grid" id="regional-stats" aria-label="Regional response statistics">
            <StatCard label="Active incidents" value={String(incidents.length + 5).padStart(2, '0')} delta="3 resolved today" icon={Siren} tone="coral" trend="down" />
            <StatCard label="Response teams" value="24" delta="6 teams available" icon={Users} tone="violet" trend="up" />
            <StatCard label="People assisted" value="1,284" delta="+12% this week" icon={HeartPulse} tone="mint" trend="up" />
            <StatCard label="Avg. response time" value="18m" delta="4 min faster" icon={Zap} tone="amber" trend="down" />
          </section>

          <section className="main-grid">
            <div className="panel map-panel" id="response-map">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">REGIONAL OVERVIEW</div>
                  <h2>Live response map <span className="live-pill"><span /> DEMO</span></h2>
                </div>
                <button className="subtle-button" onClick={() => setActivePage('Live map')}>Full map <ArrowUpRight size={15} /></button>
              </div>
              <div className="map-wrap">
                <div className="map-top-tools">
                  <button className="map-tool" onClick={() => notify('Showing all response layers')}><Layers size={15} /> Layers <ChevronDown size={13} /></button>
                  <button className="map-tool map-locate" onClick={() => notify('Map centred on Northeast India')} aria-label="Centre map"><Crosshair size={16} /></button>
                </div>
                <div className="map-label label-assam">ASSAM</div>
                <div className="map-label label-meghalaya">MEGHALAYA</div>
                <div className="map-label label-nagaland">NAGALAND</div>
                <div className="map-label label-manipur">MANIPUR</div>
                <div className="map-label label-arunachal">ARUNACHAL PRADESH</div>
                <svg className="region-map" viewBox="0 0 720 350" role="img" aria-label="Illustrated map of Northeast India with active incident markers">
                  <defs>
                    <pattern id="mapGrid" width="38" height="38" patternUnits="userSpaceOnUse">
                      <path d="M 38 0 L 0 0 0 38" fill="none" stroke="#e8eee9" strokeWidth="1" />
                    </pattern>
                    <linearGradient id="landFill" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f5f8ef" />
                      <stop offset="100%" stopColor="#edf4ed" />
                    </linearGradient>
                  </defs>
                  <rect width="720" height="350" fill="#f8faf7" />
                  <rect width="720" height="350" fill="url(#mapGrid)" />
                  <path d="M0 225 C90 206 130 244 208 220 S330 191 399 211 S525 189 720 216" fill="none" stroke="#dcece8" strokeWidth="34" opacity=".74" />
                  <path d="M0 225 C90 206 130 244 208 220 S330 191 399 211 S525 189 720 216" fill="none" stroke="#b7d9d0" strokeWidth="1.5" strokeDasharray="4 7" />
                  <path d="M111 63 L196 38 255 60 282 101 263 141 287 179 256 218 219 230 174 211 140 222 105 193 81 146 89 103Z" fill="url(#landFill)" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M255 62 L347 45 392 71 409 112 380 144 348 150 322 180 286 179 263 141 282 101Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M380 144 L427 134 456 155 448 179 412 186 386 169Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M412 186 L448 179 480 196 467 224 436 223 407 211Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M486 142 L542 131 581 153 579 186 549 203 510 187 477 173Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M481 200 L518 190 543 211 531 241 501 251 474 229Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M542 251 L567 239 586 258 577 281 551 277Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M601 217 L624 209 642 230 633 252 611 252 596 236Z" fill="#f2f7ed" stroke="#cedbcf" strokeWidth="1.5" />
                  <path d="M151 100 C184 118 211 130 247 123 M294 84 C323 98 355 102 386 96 M304 147 C333 136 352 121 380 116 M425 155 L443 168 M494 161 L546 166" fill="none" stroke="#d8e2d7" strokeWidth="1" />
                  <path d="M91 141 L145 128 182 142 218 130 257 141 M107 178 L144 173 174 192 211 182" fill="none" stroke="#dae4d8" strokeWidth="1" />
                  <circle cx="300" cy="189" r="22" fill="#f16d5c" opacity=".10" />
                  <circle cx="300" cy="189" r="12" fill="#f16d5c" opacity=".17" />
                  <circle cx="300" cy="189" r="6" fill="#f16d5c" stroke="#fff" strokeWidth="2" />
                  <circle cx="432" cy="168" r="17" fill="#eea43b" opacity=".12" />
                  <circle cx="432" cy="168" r="6" fill="#eea43b" stroke="#fff" strokeWidth="2" />
                  <circle cx="518" cy="218" r="15" fill="#eea43b" opacity=".12" />
                  <circle cx="518" cy="218" r="6" fill="#eea43b" stroke="#fff" strokeWidth="2" />
                  <circle cx="226" cy="152" r="5" fill="#3f9b75" stroke="#fff" strokeWidth="2" />
                  <circle cx="389" cy="107" r="5" fill="#3f9b75" stroke="#fff" strokeWidth="2" />
                  <circle cx="456" cy="214" r="5" fill="#3f9b75" stroke="#fff" strokeWidth="2" />
                  <circle cx="566" cy="167" r="5" fill="#3f9b75" stroke="#fff" strokeWidth="2" />
                </svg>
                <div className="map-legend">
                  <span><i className="legend-dot dot-high" /> High priority</span>
                  <span><i className="legend-dot dot-medium" /> Monitoring</span>
                  <span><i className="legend-dot dot-team" /> Response teams</span>
                </div>
                <div className="map-scale">NORTHEAST INDIA <span>·</span> 8 STATES</div>
              </div>
              <div className="map-footer">
                <span><span className="online-dot" /> 12 sample teams shown</span>
                <button onClick={() => setActivePage('Live map')}>View all activity <ArrowRight size={14} /></button>
              </div>
            </div>

            <div className="panel weather-panel">
              <div className="panel-heading">
                <div><div className="panel-kicker">FIELD CONDITIONS</div><h2>Weather watch</h2></div>
                <button className="icon-button small-icon" onClick={() => notify('Sample weather panel refreshed')} aria-label="Refresh weather"><MoreHorizontal size={18} /></button>
              </div>
              <div className="weather-location"><MapPin size={14} /> Guwahati, Assam <ChevronDown size={13} /></div>
              <div className="weather-main">
                <div className="weather-temp">28<span>°</span></div>
                <div className="weather-condition"><CloudRain size={30} /><strong>Light rain</strong><span>Feels like 31°</span></div>
              </div>
              <div className="weather-stats">
                <div><span>PRECIPITATION</span><strong>72%</strong></div>
                <div><span>WIND SPEED</span><strong>14 <small>km/h</small></strong></div>
                <div><span>VISIBILITY</span><strong>8 <small>km</small></strong></div>
              </div>
              <div className="weather-alert"><CloudRain size={16} /><span><strong>Heavy rainfall watch</strong><small>Expected in Dima Hasao · next 3 hours</small></span><ArrowRight size={15} /></div>
              <div className="forecast">
                {[
                  ['NOW', '☁', '28°'],
                  ['12 PM', '🌦', '29°'],
                  ['1 PM', '🌧', '27°'],
                  ['2 PM', '🌧', '26°'],
                  ['3 PM', '☁', '27°'],
                ].map(([time, icon, temp]) => <div className="forecast-item" key={time}><span>{time}</span><b>{icon}</b><strong>{temp}</strong></div>)}
              </div>
            </div>
          </section>

          <section className="bottom-grid">
            <div className="panel incidents-panel" id="recent-incidents">
              <div className="panel-heading">
                <div><div className="panel-kicker">NEEDS ATTENTION</div><h2>Recent incidents <span className="heading-count">{filteredIncidents.length}</span></h2></div>
                <button className="subtle-button" onClick={() => setActivePage('Incidents')}>View all <ArrowRight size={14} /></button>
              </div>
              <div className="incident-list">
                {filteredIncidents.length === 0 ? <div className="empty-state">No incidents match “{query}”.</div> : filteredIncidents.slice(0, 4).map((incident) => {
                  const IncidentIcon = iconForIncident[incident.icon]
                  return (
                    <button className="incident-row" key={incident.id} onClick={() => notify(`${incident.id} · ${incident.location}`)}>
                      <span className={`incident-icon incident-${incident.icon}`}><IncidentIcon size={17} /></span>
                      <span className="incident-main"><strong>{incident.title}</strong><small><MapPin size={11} /> {incident.location}</small></span>
                      <span className={`priority priority-${incident.priority.toLowerCase()}`}><i />{incident.priority}</span>
                      <span className="incident-status">{incident.status}</span>
                      <span className="incident-time"><Clock3 size={12} /> {incident.time}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="panel teams-panel" id="response-teams">
              <div className="panel-heading">
                <div><div className="panel-kicker">ON THE GROUND</div><h2>Response teams</h2></div>
                <button className="icon-button small-icon" onClick={() => setActivePage('Resources')} aria-label="More team options"><MoreHorizontal size={18} /></button>
              </div>
              <div className="team-summary"><span className="team-avatars"><i>🚑</i><i>🛟</i><i>🚒</i></span><span><strong>24 teams</strong><small>across 8 states</small></span><span className="team-ready"><span className="online-dot" /> 6 ready</span></div>
              <div className="team-progress-label"><span>Deployment capacity</span><strong>75%</strong></div>
              <div className="progress-track"><span /></div>
              <div className="team-locations">
                <div><span className="location-pin"><MapPin size={14} /></span><span><strong>Guwahati hub</strong><small>Assam · 8 teams</small></span><span className="team-available">3 available</span></div>
                <div><span className="location-pin"><MapPin size={14} /></span><span><strong>Shillong hub</strong><small>Meghalaya · 5 teams</small></span><span className="team-available">2 available</span></div>
                <div><span className="location-pin"><MapPin size={14} /></span><span><strong>Kohima hub</strong><small>Nagaland · 4 teams</small></span><span className="team-available">1 available</span></div>
              </div>
            </div>
          </section>

          <footer className="page-footer"><span>LifeLink Regional Response Network</span><span>Demo data · Not connected to live emergency services</span><button onClick={() => notify('Sample data is static')}>Sample data <Navigation size={12} /></button></footer>
        </div>
      </main>

      {showReport && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReport(false) }}>
          <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <div className="modal-heading">
              <div><span className="modal-icon"><Siren size={19} /></span><div><h2 id="report-title">Report an incident</h2><p>Share the details so the right team can respond.</p></div></div>
              <button className="icon-button" onClick={() => setShowReport(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={submitIncident}>
              <label>Incident type<input name="title" required placeholder="e.g. Road blocked by landslide" /></label>
              <label>Location<input name="location" required placeholder="Village, district or nearest town" /></label>
              <label>Priority<select name="priority" defaultValue="High"><option>High</option><option>Medium</option><option>Low</option></select></label>
              <div className="modal-note"><ShieldCheck size={15} /> Your report will be shared with regional response coordinators.</div>
              <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowReport(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} /> Submit report</button></div>
            </form>
          </section>
        </div>
      )}
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  )
}

function StatCard({ label, value, delta, icon: Icon, tone, trend }: {
  label: string
  value: string
  delta: string
  icon: typeof Activity
  tone: string
  trend: 'up' | 'down'
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{label}</span><span className={`stat-icon icon-${tone}`}><Icon size={17} /></span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-bottom"><span className="trend-icon"><TrendIcon size={13} /></span>{delta}</div>
    </article>
  )
}

export default App
