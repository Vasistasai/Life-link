import type { Incident, MapLocation } from '../types'

export const regions: MapLocation[] = [
  { name: 'Guwahati, Assam', state: 'Assam', lat: 26.1445, lon: 91.7362 },
  { name: 'Shillong, Meghalaya', state: 'Meghalaya', lat: 25.5788, lon: 91.8933 },
  { name: 'Imphal, Manipur', state: 'Manipur', lat: 24.817, lon: 93.9368 },
  { name: 'Aizawl, Mizoram', state: 'Mizoram', lat: 23.7271, lon: 92.7176 },
  { name: 'Agartala, Tripura', state: 'Tripura', lat: 23.8315, lon: 91.2868 },
  { name: 'Itanagar, Arunachal Pradesh', state: 'Arunachal Pradesh', lat: 27.0844, lon: 93.6053 },
  { name: 'Kohima, Nagaland', state: 'Nagaland', lat: 25.6751, lon: 94.1086 },
  { name: 'Gangtok, Sikkim', state: 'Sikkim', lat: 27.3389, lon: 88.6065 },
]

export const sampleIncidents: Incident[] = [
  {
    id: 'LL-2048',
    title: 'Flash flood watch',
    description: 'Community-reported rising water near the river crossing.',
    location: 'Dima Hasao, Assam',
    time: '12 min ago',
    severity: 'High',
    category: 'Flood',
    lat: 25.3,
    lon: 93,
    source: 'Sample',
  },
  {
    id: 'LL-2047',
    title: 'Medical assistance requested',
    description: 'A first-aid team has been requested by local volunteers.',
    location: 'Kohima, Nagaland',
    time: '34 min ago',
    severity: 'Medium',
    category: 'Medical',
    lat: 25.6751,
    lon: 94.1086,
    source: 'Sample',
  },
  {
    id: 'LL-2046',
    title: 'Road obstruction',
    description: 'Debris reported on a hill road; use an alternate route.',
    location: 'West Khasi Hills, Meghalaya',
    time: '1 hr ago',
    severity: 'Medium',
    category: 'Transport',
    lat: 25.6,
    lon: 91.3,
    source: 'Sample',
  },
  {
    id: 'LL-2045',
    title: 'Weather watch',
    description: 'Monitor local updates during periods of heavy rainfall.',
    location: 'Tinsukia, Assam',
    time: '2 hr ago',
    severity: 'Low',
    category: 'Weather',
    lat: 27.49,
    lon: 95.36,
    source: 'Sample',
  },
]

export const emergencyServices = [
  {
    name: 'All-in-one emergency',
    detail: 'Police, fire and ambulance',
    number: '112',
    icon: 'response',
    tint: 'green',
  },
  {
    name: 'Ambulance',
    detail: 'State emergency response',
    number: '108',
    icon: 'ambulance',
    tint: 'rose',
  },
  {
    name: 'Fire & rescue',
    detail: 'Fire and rescue service',
    number: '101',
    icon: 'fire',
    tint: 'amber',
  },
]

export const regionalHospitals = [
  {
    name: 'Gauhati Medical College & Hospital',
    city: 'Bhangagarh, Guwahati · Assam',
    lat: 26.16,
    lon: 91.77,
  },
  {
    name: 'NEIGRIHMS',
    city: 'Mawdiangdiang, Shillong · Meghalaya',
    lat: 25.62,
    lon: 91.9168,
  },
  {
    name: 'Regional Institute of Medical Sciences',
    city: 'Lamphelpat, Imphal · Manipur',
    lat: 24.8074,
    lon: 93.9133,
  },
]
