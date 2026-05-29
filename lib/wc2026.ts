const BASE = 'https://api.wc2026api.com'

async function apiFetch<T>(path: string): Promise<T> {
  const key = process.env.WC2026_API_KEY
  if (!key) throw new Error('WC2026_API_KEY no está configurada en .env.local')

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WC2026 API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export interface WCTeam {
  name: string
  code: string
  flag?: string
  flag_emoji?: string
  group?: string
  group_name?: string
}

export interface WCMatch {
  id?: number | string
  round?: string
  stage?: string
  home_team?: string | WCTeam
  away_team?: string | WCTeam
  home?: string
  away?: string
  venue?: string
  stadium?: string
  kickoff?: string
  match_date?: string
  date?: string
  status?: string
  home_score?: number | null
  away_score?: number | null
  group?: string
  group_name?: string
}

export async function fetchWCTeams(): Promise<WCTeam[]> {
  const data = await apiFetch<WCTeam[] | { teams: WCTeam[] }>('/teams')
  return Array.isArray(data) ? data : data.teams
}

export async function fetchWCMatches(): Promise<WCMatch[]> {
  const data = await apiFetch<WCMatch[] | { matches: WCMatch[] }>('/matches')
  return Array.isArray(data) ? data : data.matches
}

const STAGE_MAP: Record<string, string> = {
  'group stage': 'group',
  'group': 'group',
  'round of 32': 'round_of_32',
  'round of 16': 'round_of_16',
  'quarterfinals': 'quarter',
  'quarter-finals': 'quarter',
  'quarterfinal': 'quarter',
  'semifinals': 'semi',
  'semi-finals': 'semi',
  'semifinal': 'semi',
  'third place': 'third_place',
  'third-place': 'third_place',
  'third place playoff': 'third_place',
  'final': 'final',
}

export function normalizeStage(raw: string): string {
  return STAGE_MAP[raw.toLowerCase()] ?? 'group'
}

export function normalizeStatus(raw?: string): string {
  const s = (raw ?? 'scheduled').toLowerCase()
  if (s === 'live' || s === 'in progress') return 'live'
  if (s === 'finished' || s === 'completed' || s === 'ft') return 'finished'
  return 'scheduled'
}

export function teamName(t: string | WCTeam | undefined): string {
  if (!t) return ''
  return typeof t === 'string' ? t : t.name
}
