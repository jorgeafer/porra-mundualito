export async function register() {
  // Solo en el runtime de Node.js (no en Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

  async function runSync() {
    try {
      const { syncResults } = await import('./lib/sync-results')
      const report = await syncResults()
      if (report.updated > 0 || report.errors.length > 0) {
        console.log(
          `[cron] sync-results: ${report.updated} partidos actualizados, ` +
          `${report.pointsRecalculated} predicciones recalculadas` +
          (report.errors.length ? `, errores: ${report.errors.join(' | ')}` : '')
        )
      }
    } catch (err) {
      console.error('[cron] sync-results falló:', err)
    }
  }

  // Primera ejecución al arrancar el servidor
  runSync()

  // Luego cada 5 minutos
  setInterval(runSync, INTERVAL_MS)
}
