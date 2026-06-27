// raw.githubusercontent.com no es accesible desde Windows Node.js — usamos la GitHub API
const API_URL =
  'https://api.github.com/repos/openfootball/worldcup.json/contents/2026/worldcup.json'

export interface OFMatch {
  round: string
  date: string
  time?: string
  team1: string
  team2: string
  group?: string
  ground?: string
  num?: number
  score?: { ft: [number, number] }
}

export async function fetchOFMatches(): Promise<OFMatch[]> {
  const res = await fetch(API_URL, {
    cache: 'no-store',
    headers: { 'User-Agent': 'porra-mundualito', Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const meta: { content: string } = await res.json()
  const json = Buffer.from(meta.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  const data: { matches: OFMatch[] } = JSON.parse(json)
  return data.matches
}

// Teams are referenced by name only — derive a 3-letter code
const KNOWN_CODES: Record<string, string> = {
  'United States': 'USA',
  'South Korea': 'KOR',
  'Saudi Arabia': 'KSA',
  'South Africa': 'RSA',
  'New Zealand': 'NZL',
  'Costa Rica': 'CRC',
  'Ivory Coast': 'CIV',
  "Côte d'Ivoire": 'CIV',
  'DR Congo': 'COD',
  'Congo DR': 'COD',
  'Bosnia and Herzegovina': 'BIH',
  'Trinidad and Tobago': 'TTO',
  'Dominican Republic': 'DOM',
  'Guinea-Bissau': 'GNB',
  'Equatorial Guinea': 'EQG',
  'Papua New Guinea': 'PNG',
  'New Caledonia': 'NCL',
  'El Salvador': 'SLV',
  'Hong Kong': 'HKG',
  'Cape Verde': 'CPV',
  'Sierra Leone': 'SLE',
  'Burkina Faso': 'BFA',
  'Central African Republic': 'CAR',
  'Czech Republic': 'CZE',
  'North Macedonia': 'MKD',
  'Northern Ireland': 'NIR',
}

export function nameToCode(name: string): string {
  if (KNOWN_CODES[name]) return KNOWN_CODES[name]
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase()
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
}

// Qualifier codes: "W74"/"L101" (winner/loser of match) or "2A"/"1B"/"3A/B/C/D/F" (group position)
export function isQualifierCode(name: string): boolean {
  return /^[WL]\d+$/.test(name) || /^\d[A-Z](\/[A-Z])*$/.test(name)
}

const STAGE_MAP: Record<string, string> = {
  'matchday 1': 'group',
  'matchday 2': 'group',
  'matchday 3': 'group',
  'round of 32': 'round_of_32',
  'round of 16': 'round_of_16',
  'quarterfinals': 'quarter',
  'quarter-finals': 'quarter',
  'semifinals': 'semi',
  'semi-finals': 'semi',
  'third place': 'third_place',
  '3rd place': 'third_place',
  'final': 'final',
}

export function normalizeOFStage(round: string): string {
  return STAGE_MAP[round.toLowerCase()] ?? 'group'
}
