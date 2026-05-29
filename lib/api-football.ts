const BASE = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string): Promise<{ response: T[]; errors: unknown[] }> {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) throw new Error('API_FOOTBALL_KEY no está configurada en .env.local')

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': key },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API-Football ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`)
  }
  return json
}

export interface AFTeam {
  team: {
    id: number
    name: string
    code: string
    logo: string
  }
}

export interface AFFixture {
  fixture: {
    id: number
    date: string
    venue: { name: string | null; city: string | null }
    status: { long: string; short: string; elapsed: number | null }
  }
  league: {
    round: string
  }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

export async function fetchAFTeams(): Promise<AFTeam[]> {
  const data = await apiFetch<AFTeam>('/teams?league=1&season=2026')
  return data.response
}

export async function fetchAFFixtures(): Promise<AFFixture[]> {
  const data = await apiFetch<AFFixture>('/fixtures?league=1&season=2026')
  return data.response
}

// "Group Stage - 1" → "group", "Round of 32" → "round_of_32", etc.
const STAGE_MAP: Record<string, string> = {
  'group stage': 'group',
  'round of 32': 'round_of_32',
  'round of 16': 'round_of_16',
  'quarter-finals': 'quarter',
  'quarterfinals': 'quarter',
  'semi-finals': 'semi',
  'semifinals': 'semi',
  '3rd place final': 'third_place',
  'third place': 'third_place',
  'final': 'final',
}

export function normalizeAFStage(round: string): string {
  const key = round.toLowerCase().replace(/ - \d+$/, '').trim()
  return STAGE_MAP[key] ?? 'group'
}

const LIVE_SHORT = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])
const FINISHED_SHORT = new Set(['FT', 'AET', 'PEN'])

export function normalizeAFStatus(short: string): string {
  if (LIVE_SHORT.has(short)) return 'live'
  if (FINISHED_SHORT.has(short)) return 'finished'
  return 'scheduled'
}
