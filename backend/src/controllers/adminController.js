const scrapingService = require('../services/scrapingService')
const tvtCalculationService = require('../services/tvtCalculationService')
const { LeagueSettings, MatchdayScore, Team, TvtResult } = require('../models')
const scraperConfig = require('../config/scraper')

/**
 * POST /api/scrape/init
 * Inizializzazione completa: login → impostazioni → squadre
 * Deve essere eseguito al primo avvio e dopo ogni cambio di stagione
 */
const initScrape = async (req, res) => {
  try {
    console.log('[Admin] Avvio inizializzazione scraping...')
    const result = await scrapingService.initScraping()

    return res.json({
      success: true,
      message: 'Inizializzazione completata',
      data: {
        teamsCount: result.teams.length,
        serieA: result.teams.filter(t => t.serie === 'A').length,
        serieB: result.teams.filter(t => t.serie === 'B').length,
        settings: {
          punteggiBase: result.settings.punteggiBase,
          puntiPerGol: result.settings.puntiPerGol,
          totalMatchdays: result.settings.totalMatchdays,
          lastAvailableMatchday: result.settings.lastAvailableMatchday,
        },
      },
    })
  } catch (err) {
    console.error('[Admin/init] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/scrape/:matchday
 * Scraping + calcolo TvT per una giornata specifica
 */
const scrapeMatchday = async (req, res) => {
  try {
    const matchday = parseInt(req.params.matchday, 10)

    if (isNaN(matchday) || matchday < 1 || matchday > 38) {
      return res.status(400).json({
        success: false,
        message: 'Giornata deve essere un numero tra 1 e 38',
      })
    }

    console.log(`[Admin] Scraping giornata ${matchday}...`)

    // 1. Scraping punteggi
    const scores = await scrapingService.scrapeAndSaveMatchday(matchday)

    if (!scores.length) {
      return res.status(422).json({
        success: false,
        message: `Giornata ${matchday} non ancora disponibile su leghe.fantacalcio.it`,
      })
    }

    // 2. Calcolo TvT
    const tvtResults = await tvtCalculationService.calculateMatchday(matchday)

    const serieACount = tvtResults.serieA?.length || 0
    const serieBCount = tvtResults.serieB?.length || 0

    return res.json({
      success: true,
      message: `Giornata ${matchday} calcolata`,
      data: {
        matchday,
        scoresLoaded: scores.length,
        tvtResultsSerieA: serieACount,
        tvtResultsSerieB: serieBCount,
      },
    })
  } catch (err) {
    console.error(`[Admin/scrape] Errore:`, err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/scrape/all
 * Scraping + calcolo di tutte le giornate disponibili
 */
const scrapeAll = async (req, res) => {
  try {
    const season = req.query.season || scraperConfig.season

    // Recupera l'ultima giornata disponibile dalle impostazioni
    const leagueSettings = await LeagueSettings.findOne({
      season,
      legaSlug: scraperConfig.legaSlug,
    })

    const lastMatchday = leagueSettings?.lastAvailableMatchday || 38
    console.log(`[Admin] Scraping di tutte le giornate fino alla ${lastMatchday}...`)

    const processed = []
    const failed = []

    for (let matchday = 1; matchday <= lastMatchday; matchday++) {
      try {
        const scores = await scrapingService.scrapeAndSaveMatchday(matchday)

        if (scores.length > 0) {
          await tvtCalculationService.calculateMatchday(matchday, season)
          processed.push(matchday)
        } else {
          console.log(`[Admin] Giornata ${matchday}: nessun punteggio disponibile, skip`)
        }
      } catch (err) {
        console.error(`[Admin] Errore giornata ${matchday}:`, err.message)
        failed.push({ matchday, error: err.message })
      }

      // Piccolo delay per non sovraccaricare le API
      await new Promise(r => setTimeout(r, 500))
    }

    return res.json({
      success: true,
      message: `Scraping completato`,
      data: {
        processedMatchdays: processed,
        failedMatchdays: failed,
        total: processed.length,
      },
    })
  } catch (err) {
    console.error('[Admin/scrapeAll] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/scrape/recalculate
 * Ricalcola i TvtResult per tutte le giornate già in DB (senza riscraping)
 */
const recalculateAll = async (req, res) => {
  try {
    const season = req.query.season || scraperConfig.season
    const calculated = await tvtCalculationService.calculateAllMatchdays(season)

    return res.json({
      success: true,
      message: `Ricalcolo completato`,
      data: { calculatedMatchdays: calculated, total: calculated.length },
    })
  } catch (err) {
    console.error('[Admin/recalculate] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/status
 * Stato del sistema: ultima giornata calcolata, dati lega, ecc.
 */
const getStatus = async (req, res) => {
  try {
    const season = req.query.season || scraperConfig.season

    const [leagueSettings, lastMatchday, scoresCount] = await Promise.all([
      LeagueSettings.findOne({ season, legaSlug: scraperConfig.legaSlug }),
      tvtCalculationService.getLastCalculatedMatchday(season),
      MatchdayScore.countDocuments({ season }),
    ])

    return res.json({
      success: true,
      data: {
        season,
        legaSlug: scraperConfig.legaSlug,
        initialized: !!leagueSettings,
        lastCalculatedMatchday: lastMatchday,
        totalScoresInDB: scoresCount,
        settings: leagueSettings
          ? {
              punteggiBase: leagueSettings.punteggiBase,
              puntiPerGol: leagueSettings.puntiPerGol,
              totalMatchdays: leagueSettings.totalMatchdays,
              lastAvailableMatchday: leagueSettings.lastAvailableMatchday,
              competitionStartDay: leagueSettings.competitionStartDay,
              nextMatchdayDate: leagueSettings.nextMatchdayDate,
              lastScrapedAt: leagueSettings.lastScrapedAt,
            }
          : null,
      },
    })
  } catch (err) {
    console.error('[Admin/status] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/scrape/cookie
 * Aggiorna il cookie FCLeague2026 in memoria (senza riavviare il server)
 * Body: { cookie: "0=Tx2vNoPPNA1..." }
 */
const updateCookie = async (req, res) => {
  try {
    const { cookie } = req.body
    if (!cookie) {
      return res.status(400).json({ success: false, message: 'Campo "cookie" obbligatorio nel body' })
    }
    await scrapingService.updateLegacyCookie(cookie)
    return res.json({ success: true, message: 'Cookie FCLeague2026 aggiornato in memoria. Aggiungi anche FC_LEGACY_COOKIE nel .env per persistenza.' })
  } catch (err) {
    console.error('[Admin/cookie] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * PATCH /api/scrape/homeaway/:matchday
 * Aggiorna solo il campo isHome per una giornata già in DB,
 * poi ricalcola il TvT con fattore campo corretto.
 * Non fa re-scraping dei punteggi.
 */
const updateHomeAway = async (req, res) => {
  try {
    const matchday = parseInt(req.params.matchday, 10)
    if (isNaN(matchday) || matchday < 1 || matchday > 38) {
      return res.status(400).json({ success: false, message: 'Giornata deve essere tra 1 e 38' })
    }

    console.log(`[Admin] Aggiornamento home/away giornata ${matchday}...`)
    const updated = await scrapingService.updateHomeAwayForMatchday(matchday)

    // Ricalcola TvT con i valori isHome aggiornati
    const tvtResults = await tvtCalculationService.calculateMatchday(matchday)

    return res.json({
      success: true,
      message: `Home/Away aggiornato e TvT ricalcolato per giornata ${matchday}`,
      data: {
        matchday,
        homeAwayUpdated: updated.length,
        homeTeams: updated.filter(t => t.isHome).map(t => t.teamName),
        awayTeams: updated.filter(t => !t.isHome && t.isHome !== null).map(t => t.teamName),
        nullTeams: updated.filter(t => t.isHome === null).map(t => t.teamName),
        tvtResultsSerieA: tvtResults.serieA?.length || 0,
        tvtResultsSerieB: tvtResults.serieB?.length || 0,
      },
    })
  } catch (err) {
    console.error('[Admin/homeaway] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/debug/calendar/:matchday
 * Mostra la struttura raw del calendario per la giornata interna specificata.
 * Utile per diagnosticare il parsing del fattore campo.
 */
const debugCalendar = async (req, res) => {
  try {
    const matchday = parseInt(req.params.matchday, 10)
    const { competitionId, competitionIdB } = await scrapingService.getCompetitions()

    const [calA, calB] = await Promise.all([
      scrapingService.getRawCalendar(competitionId),
      competitionIdB ? scrapingService.getRawCalendar(competitionIdB) : null,
    ])

    // Costruisce anche la homeMap per mostrare il risultato del parsing
    const homeMap = await scrapingService.getHomeAwayMap(matchday)
    const homeMapObj = {}
    homeMap.forEach((v, k) => { homeMapObj[k] = v ? 'casa' : 'trasferta' })

    return res.json({
      success: true,
      matchday,
      competitionId,
      competitionIdB,
      calendarRawSerieA: calA,
      calendarRawSerieB: calB,
      homeMapParsed: homeMapObj,
      homeMapSize: homeMap.size,
    })
  } catch (err) {
    console.error('[Debug/calendar] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/debug/scores/:matchday
 * Mostra i MatchdayScore nel DB con i campi isHome e score per diagnostica.
 */
const debugScores = async (req, res) => {
  try {
    const matchday = parseInt(req.params.matchday, 10)
    const season = req.query.season || scraperConfig.season

    const { MatchdayScore: MDS } = require('../models')
    const scores = await MDS.find({ matchday, season }).populate('teamId', 'name serie leagueTeamId')
    const data = scores.map(s => ({
      teamName: s.teamId?.name,
      serie: s.teamId?.serie,
      leagueTeamId: s.teamId?.leagueTeamId,
      score: s.score,
      isHome: s.isHome,
      homeAdjusted: s.isHome === true ? s.score - 2 : s.score,
      virtualGoals: s.virtualGoals,
    }))

    return res.json({ success: true, matchday, season, count: data.length, scores: data })
  } catch (err) {
    console.error('[Debug/scores] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/scrape/reset
 * Cancella tutti i dati della stagione dal DB e reinizializza da zero.
 */
const resetAndInit = async (req, res) => {
  try {
    const season = req.query.season || scraperConfig.season
    console.log('[Admin] RESET DB season:', season)

    const [t, ms, tvt, ls] = await Promise.all([
      Team.deleteMany({ season }),
      MatchdayScore.deleteMany({ season }),
      TvtResult.deleteMany({ season }),
      LeagueSettings.deleteMany({ season, legaSlug: scraperConfig.legaSlug }),
    ])
    console.log(`[Admin] Cancellati: ${t.deletedCount} team, ${ms.deletedCount} scores, ${tvt.deletedCount} tvt, ${ls.deletedCount} settings`)

    const result = await scrapingService.initScraping()

    return res.json({
      success: true,
      message: 'Reset e reinizializzazione completati',
      data: {
        deleted: { teams: t.deletedCount, scores: ms.deletedCount, tvt: tvt.deletedCount },
        teamsCount: result.teams.length,
        serieA: result.teams.filter(x => x.serie === 'A').length,
        serieB: result.teams.filter(x => x.serie === 'B').length,
        settings: {
          punteggiBase: result.settings.punteggiBase,
          puntiPerGol: result.settings.puntiPerGol,
          lastAvailableMatchday: result.settings.lastAvailableMatchday,
        },
      },
    })
  } catch (err) {
    console.error('[Admin/reset] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  initScrape,
  resetAndInit,
  scrapeMatchday,
  scrapeAll,
  recalculateAll,
  getStatus,
  updateCookie,
  updateHomeAway,
  debugCalendar,
  debugScores,
}
