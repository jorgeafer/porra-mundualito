export type ScoringConfig = {
  exact_score: number    // acertar marcador exacto
  correct_result: number // acertar resultado (1X2)
}

export const DEFAULT_SCORING: ScoringConfig = {
  exact_score: 4,
  correct_result: 1,
}

export function calculatePoints(
  predicted: { home: number; away: number },
  actual: { home: number; away: number },
  config: ScoringConfig = DEFAULT_SCORING
): number {
  if (predicted.home === actual.home && predicted.away === actual.away) {
    return config.exact_score
  }

  const predictedSign = Math.sign(predicted.home - predicted.away)
  const actualSign = Math.sign(actual.home - actual.away)

  if (predictedSign === actualSign) {
    return config.correct_result
  }

  return 0
}
