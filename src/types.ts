export type MapLocation = {
  name: string
  state: string
  lat: number
  lon: number
}

export type Incident = {
  id: string
  title: string
  description: string
  location: string
  time: string
  severity: 'High' | 'Medium' | 'Low'
  category: string
  lat: number
  lon: number
  source: 'Sample' | 'Community'
  image?: string
}

export type WeatherData = {
  temperature: number
  apparentTemperature: number
  humidity: number
  precipitation: number
  wind: number
  description: string
  updatedAt: string
}
