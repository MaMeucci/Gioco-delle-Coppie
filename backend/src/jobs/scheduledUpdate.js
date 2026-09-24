/**
 * scheduledUpdate.js
 * Cron job che controlla automaticamente nuove giornate disponibili
 * e aggiorna la classifica TvT ogni ora durante la stagione.
 */

const cron = require('node-cron')
const scrapingService = require('../services/scrapingService')
const tvtCalculationService = require('../services/tvtCalculationService')
const { LeagueSettings } = require('../models')
const scraperConfig = require('../config/scraper')

let isRunning = false

async function runUpdate() {
  if (isRunning) {
    console.log('[Cron] Aggiornamento già in corso, skip')
    return
  }

  isRunning = true
  console.log('[Cron] Avvio aggiornamento automatico...')

  try {
    const season = scraperConfig.season
    const leagueSettings = await LeagueSettings.findOne({
      season,
      legaSlug: scraperConfig.legaSlug,
    })

    if (!leagueSettings) {
      console.log('[Cron] Lega non inizializzata. Esegui POST /api/scrape/init prima.')
      return
    }

    const lastCalculated = await tvtCalculationService.getLastCalculatedMatchday(season)
    const lastAvailable = leagueSettings.lastAvailableMatchday

    // Aggiorna le impostazioni per conoscere l'ultima giornata disponibile
    await scrapingService.getLeagueSettings()

    // Recupera impostazioni aggiornate
    const updatedSettings = await LeagueSettings.findOne({ season, legaSlug: scraperConfig.legaSlug })
    const newLastAvailable = updatedSettings?.lastAvailableMatchday || lastAvailable

    if (newLastAvailable > lastCalculated) {
      console.log(`[Cron] Nuove giornate disponibili: ${lastCalculated + 1} → ${newLastAvailable}`)

      for (let matchday = lastCalculated + 1; matchday <= newLastAvailable; matchday++) {
        try {
          const scores = await scrapingService.scrapeAndSaveMatchday(matchday)
          if (scores.length > 0) {
            await tvtCalculationService.calculateMatchday(matchday, season)
            console.log(`[Cron] ✅ Giornata ${matchday} aggiornata`)
          }
        } catch (err) {
          console.error(`[Cron] Errore giornata ${matchday}:`, err.message)
        }
        await new Promise(r => setTimeout(r, 1000))
      }
    } else {
      console.log(`[Cron] Nessuna nuova giornata (ultima calcolata: ${lastCalculated})`)
    }
  } catch (err) {
    console.error('[Cron] Errore aggiornamento:', err.message)
  } finally {
    isRunning = false
  }
}

/**
 * Avvia il cron job.
 * Schedule: ogni ora nei minuti 30 (es. 10:30, 11:30, ...)
 * Il sabato e la domenica ogni 30 minuti per le giornate in tempo reale.
 */
function startCronJob() {
  // Ogni ora a :30 — giorni feriali
  cron.schedule('30 * * * 1-5', () => {
    console.log('[Cron] Trigger orario (feriale)')
    runUpdate()
  })

  // Ogni 30 minuti — sabato e domenica (giornate di campionato)
  cron.schedule('*/30 * * * 0,6', () => {
    console.log('[Cron] Trigger 30min (weekend)')
    runUpdate()
  })

  console.log('[Cron] Job avviato (ogni ora feriali, ogni 30min weekend)')
}

module.exports = { startCronJob, runUpdate }
