export type ScoringConfig = {
  exact_score: number    // acertar marcador exacto
  correct_diff: number   // acertar diferencia pero no el marcador
  correct_result: number // acertar resultado (1X2) pero no la diferencia
}

export const DEFAULT_SCORING: ScoringConfig = {
  exact_score: 3,
  correct_diff: 2,
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

  const predictedDiff = predicted.home - predicted.away
  const actualDiff = actual.home - actual.away

  if (predictedDiff === actualDiff) {
    return config.correct_diff
  }

  if (Math.sign(predictedDiff) === Math.sign(actualDiff)) {
    return config.correct_result
  }

  return 0
}
