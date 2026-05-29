export async function register() {
  // Solo en el runtime de Node.js (no en Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Red corporativa con proxy SSL: deshabilitar verificación TLS solo en dev
  if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 horas

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
