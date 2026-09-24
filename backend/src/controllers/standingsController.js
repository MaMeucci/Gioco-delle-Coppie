const tvtCalculationService = require('../services/tvtCalculationService')
const scraperConfig = require('../config/scraper')

/**
 * GET /api/standings/:serie
 * Restituisce la classifica TvT aggregata per la serie indicata (A o B)
 */
const getStandings = async (req, res) => {
  try {
    const { serie } = req.params
    const season = req.query.season || scraperConfig.season

    if (!['A', 'B'].includes(serie.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Serie deve essere A o B',
      })
    }

    const standings = await tvtCalculationService.getStandings(serie, season)

    return res.json({
      success: true,
      data: {
        serie: serie.toUpperCase(),
        season,
        standings,
        total: standings.length,
      },
    })
  } catch (err) {
    console.error('[Controller/standings] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/standings
 * Restituisce entrambe le classifiche (Serie A e B)
 */
const getAllStandings = async (req, res) => {
  try {
    const season = req.query.season || scraperConfig.season

    const [serieA, serieB] = await Promise.all([
      tvtCalculationService.getStandings('A', season),
      tvtCalculationService.getStandings('B', season),
    ])

    return res.json({
      success: true,
      data: {
        season,
        serieA: { standings: serieA, total: serieA.length },
        serieB: { standings: serieB, total: serieB.length },
      },
    })
  } catch (err) {
    console.error('[Controller/standings] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getStandings, getAllStandings }
