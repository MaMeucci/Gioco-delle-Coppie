const { Team } = require('../models')
const scraperConfig = require('../config/scraper')

/**
 * GET /api/teams
 * Restituisce tutte le squadre, raggruppate per serie
 */
const getAllTeams = async (req, res) => {
  try {
    const season = req.query.season || scraperConfig.season

    const teams = await Team.find({ season, active: true })
      .select('name serie leagueTeamId ownerName season')
      .sort({ serie: 1, name: 1 })

    const serieA = teams.filter(t => t.serie === 'A')
    const serieB = teams.filter(t => t.serie === 'B')

    return res.json({
      success: true,
      data: {
        season,
        total: teams.length,
        serieA: serieA.map(t => ({ id: t._id, name: t.name, ownerName: t.ownerName, leagueTeamId: t.leagueTeamId })),
        serieB: serieB.map(t => ({ id: t._id, name: t.name, ownerName: t.ownerName, leagueTeamId: t.leagueTeamId })),
      },
    })
  } catch (err) {
    console.error('[Controller/teams] Errore:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getAllTeams }
