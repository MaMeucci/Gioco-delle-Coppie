const { Router } = require('express')
const adminAuth = require('../middleware/adminAuth')
const {
  initScrape,
  scrapeMatchday,
  scrapeAll,
  recalculateAll,
  getStatus,
  updateCookie,
  updateHomeAway,
  debugCalendar,
  debugScores,
} = require('../controllers/adminController')

const router = Router()

// GET  /api/status — pubblico, mostra stato sistema
router.get('/status', getStatus)

// ─── Debug (protetti da adminAuth) ───────────────────────────────────────────
// GET /api/debug/calendar/:matchday — struttura raw calendario API + homeMap parsata
router.get('/debug/calendar/:matchday', adminAuth, debugCalendar)

// GET /api/debug/scores/:matchday — punteggi nel DB con isHome e adjusted score
router.get('/debug/scores/:matchday', adminAuth, debugScores)

// ─── Scraping (protetti da adminAuth) ────────────────────────────────────────
// POST /api/scrape/init — inizializzazione lega (squadre + impostazioni)
router.post('/scrape/init', adminAuth, initScrape)

// POST /api/scrape/cookie — aggiorna il cookie FCLeague2026 in memoria
router.post('/scrape/cookie', adminAuth, updateCookie)

// POST /api/scrape/all — scraping + calcolo tutte le giornate
router.post('/scrape/all', adminAuth, scrapeAll)

// POST /api/scrape/recalculate — ricalcola TvT da dati già in DB (senza riscraping)
router.post('/scrape/recalculate', adminAuth, recalculateAll)

// PATCH /api/scrape/homeaway/:matchday — aggiorna solo isHome + ricalcola TvT
router.patch('/scrape/homeaway/:matchday', adminAuth, updateHomeAway)

// POST /api/scrape/:matchday — scraping + calcolo giornata specifica
// NOTA: deve stare DOPO le route statiche (/init, /cookie, /all, /recalculate)
router.post('/scrape/:matchday', adminAuth, scrapeMatchday)

module.exports = router
