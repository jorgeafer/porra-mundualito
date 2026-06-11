const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION_CODE = 'WC'

export interface FDMatch {
  homeTeam: { name: string; shortName: string; tla: string }
  awayTeam: { name: string; shortName: string; tla: string }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  status: string
}

export async function fetchFinishedMatches(): Promise<FDMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY no configurada')

  const res = await fetch(`${BASE_URL}/competitions/${COMPETITION_CODE}/matches?status=FINISHED`, {
    cache: 'no-store',
    headers: { 'X-Auth-Token': apiKey },
  })

  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`)

  const data: { matches: FDMatch[] } = await res.json()
  return data.matches.filter(
    m => m.score.fullTime.home !== null && m.score.fullTime.away !== null
  )
}
