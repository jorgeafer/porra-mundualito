const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION_CODE = 'WC'

export interface FDMatch {
  homeTeam: { name: string | null; shortName: string | null; tla: string | null }
  awayTeam: { name: string | null; shortName: string | null; tla: string | null }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  status: string
  utcDate: string
  stage: string
  group?: string | null
  venue?: string | null
}

// Shared name normalization (accent-insensitive lowercase)
export function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Names that football-data.org uses differently from our DB (keyed by normalized fd.org name)
export const FD_NAME_MAP: Record<string, string> = {
  // América
  'united states': 'usa',
  // Europa
  'czechia': 'czech republic',
  'republic of ireland': 'ireland',
  'bosnia and herzegovina': 'bosnia & herzegovina',
  'bosnia-herzegovina': 'bosnia & herzegovina',
  // Asia
  'korea republic': 'south korea',
  'ir iran': 'iran',
  'china pr': 'china',
  'united arab emirates': 'uae',
  // África
  "cote d'ivoire": 'ivory coast',
  'congo dr': 'dr congo',
  'democratic republic of congo': 'dr congo',
  'cape verde islands': 'cape verde',
}

export function resolveTeamName(name: string): string {
  const n = normalize(name)
  return FD_NAME_MAP[n] ?? n
}

// Variant with guaranteed non-null team names (after filtering out TBD matches)
export type FDMatchKnown = Omit<FDMatch, 'homeTeam' | 'awayTeam'> & {
  homeTeam: { name: string; shortName: string; tla: string }
  awayTeam: { name: string; shortName: string; tla: string }
}

// TBD/placeholder team names from football-data.org for knockout rounds
const TBD_NAMES = new Set(['tbd', 'to be determined', '', 'winner match', 'loser match'])

function isTBDTeam(team: { name: string | null }): boolean {
  if (!team.name) return true
  const n = normalize(team.name)
  if (TBD_NAMES.has(n)) return true
  // Patterns like "Winner Match 1", "Loser Match 2", "Winner Group A"
  if (/^(winner|loser|w|l)\s*(match|group)?\s*\d*[a-z]?$/i.test(team.name.trim())) return true
  return false
}

export function filterKnownMatches(matches: FDMatch[]): FDMatchKnown[] {
  return matches.filter(
    m => !isTBDTeam(m.homeTeam) && !isTBDTeam(m.awayTeam)
  ) as FDMatchKnown[]
}

const STAGE_MAP: Record<string, string> = {
  'group_stage': 'group',
  'round_of_32': 'round_of_32',
  'last_32': 'round_of_32',
  'round_of_16': 'round_of_16',
  'last_16': 'round_of_16',
  'quarter_finals': 'quarter',
  'quarterfinals': 'quarter',
  'semi_finals': 'semi',
  'semifinals': 'semi',
  'third_place': 'third_place',
  'third_place_playoff': 'third_place',
  'play_off_3rd_place': 'third_place',
  'final': 'final',
}

export function normalizeFDStage(stage: string): string {
  return STAGE_MAP[stage.toLowerCase()] ?? 'group'
}

export function normalizeFDGroup(group: string | null | undefined): string | null {
  if (!group) return null
  // "GROUP_A" → "A", "Group A" → "A"
  return group.replace(/^group[_\s]*/i, '').trim().slice(0, 1).toUpperCase() || null
}

async function fetchFDMatches(params: string): Promise<FDMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY no configurada')

  const res = await fetch(`${BASE_URL}/competitions/${COMPETITION_CODE}/matches${params}`, {
    cache: 'no-store',
    headers: { 'X-Auth-Token': apiKey },
  })

  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`)

  const data: { matches: FDMatch[] } = await res.json()
  return data.matches
}

export async function fetchFinishedMatches(): Promise<FDMatch[]> {
  const matches = await fetchFDMatches('?status=FINISHED')
  return matches.filter(
    m => m.score.fullTime.home !== null && m.score.fullTime.away !== null
  )
}

export async function fetchAllWCMatches(): Promise<FDMatch[]> {
  return fetchFDMatches('')
}
