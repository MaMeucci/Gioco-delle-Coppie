const tvtCalculationService = require('../services/tvtCalculationService')
const scraperConfig = require('../config/scraper')

/**
 * GET /api/matchday/:matchday
 * Risultati TvT di una giornata specifica (entrambe le serie)
 */
const getMatchdayResults = async (req, res) => {
  try {
    const matchday = parseInt(req.params.matchday, 10)
    const season = req.query.season || scraperConfig.season

    if (isNaN(matchday) || matchday < 1 || matchday > 38) {
      return res.status(400).json({
        success: false,
        message: 'Giornata deve essere un numero tra 1 e 38',
      })
    }

    const results = await tvtCalculationService.getMatchdayResults(matchday, null, season)

    return res.json({
      success: true,
      data: results,
    })
  } catch (err) {
    console.error('[Controller/matchday] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/matchday/:matchday/:serie
 * Risultati TvT di una giornata per una serie specifica
 */
const getMatchdayResultsBySerie = async (req, res) => {
  try {
    const matchday = parseInt(req.params.matchday, 10)
    const { serie } = req.params
    const season = req.query.season || scraperConfig.season

    if (isNaN(matchday) || matchday < 1 || matchday > 38) {
      return res.status(400).json({
        success: false,
        message: 'Giornata deve essere un numero tra 1 e 38',
      })
    }

    if (!['A', 'B'].includes(serie.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Serie deve essere A o B' })
    }

    const results = await tvtCalculationService.getMatchdayResults(matchday, serie, season)

    return res.json({
      success: true,
      data: results,
    })
  } catch (err) {
    console.error('[Controller/matchday] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getMatchdayResults, getMatchdayResultsBySerie }
