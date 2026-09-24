/**
 * tvtCalculationService.js
 *
 * Motore di calcolo per la competizione "Tutti vs Tutti".
 *
 * REGOLE:
 *   1. FATTORE CAMPO: se una squadra gioca in casa in quel turno di campionato,
 *      si sottraggono 2 punti dal suo fantapunteggio prima del confronto TvT.
 *      → adjustedScore = score - 2  (se isHome === true)
 *      → adjustedScore = score      (se isHome === false o null)
 *
 *   2. GOL VIRTUALI: dal adjustedScore si calcolano i gol virtuali
 *      gol = floor((adjustedScore - punteggiBase) / puntiPerGol)
 *
 *   3. CONFRONTO:
 *      - Gol A > Gol B → A vince (3pt), B perde (0pt)
 *      - Gol A = Gol B → pareggio (1pt ciascuno)
 *      - Gol A < Gol B → A perde (0pt), B vince (3pt)
 *
 *   4. REGOLA DIFFERENZA 4 PUNTI: se la differenza di adjustedScore tra le
 *      due squadre è > 4pt, la squadra col punteggio più alto vince sempre,
 *      indipendentemente dai gol virtuali (come se ricevesse un gol in più).
 *      Es. A=71 B=66 → diff=5 > 4 → A vince anche se stessa fascia gol.
 *
 *   Max punti per giornata: 9 avversari × 3pt = 27pt
 */

const { MatchdayScore, TvtResult, LeagueSettings, Team } = require('../models')
const scraperConfig = require('../config/scraper')

// ─── Conversione punteggio → gol virtuali ────────────────────────────────────

/**
 * Calcola i gol virtuali da un punteggio fantacalcio.
 * @param {number} score - Punteggio fantacalcio
 * @param {number} punteggiBase - Punteggio base (es. 60)
 * @param {number} puntiPerGol - Punti per ogni gol virtuale (es. 6)
 * @returns {number} Gol virtuali (può essere negativo)
 */
// Differenza di punteggio oltre cui si applica la regola "bonus gol"
const DIFF_THRESHOLD = 4

function calcVirtualGoals(score, punteggiBase, puntiPerGol) {
  if (!puntiPerGol || puntiPerGol <= 0) return 0
  return Math.floor((score - punteggiBase) / puntiPerGol)
}

/**
 * Calcola l'adjustedScore applicando il fattore campo.
 * @param {number} score - Punteggio grezzo
 * @param {boolean|null} isHome - true = in casa → -2pt
 * @returns {{ adjustedScore: number, homeAdjustment: number }}
 */
function applyHomeAdjustment(score, isHome) {
  const homeAdjustment = isHome === true ? -2 : 0
  return { adjustedScore: score + homeAdjustment, homeAdjustment }
}

/**
 * Determina il risultato di uno scontro diretto tra due squadre.
 * Applica entrambe le regole:
 *   1. Gol virtuali (da adjustedScore)
 *   2. Regola differenza > 4pt → vittoria diretta
 *
 * @param {number} adjustedScoreA - Punteggio effettivo squadra A (dopo fattore campo)
 * @param {number} adjustedScoreB - Punteggio effettivo squadra B (dopo fattore campo)
 * @param {number} goalsA - Gol virtuali squadra A
 * @param {number} goalsB - Gol virtuali squadra B
 * @returns {{ resultA: 'W'|'D'|'L', resultB: 'W'|'D'|'L', pointsA: number, pointsB: number, rule: string }}
 */
function determineResult(adjustedScoreA, adjustedScoreB, goalsA, goalsB) {
  const diff = Math.abs(adjustedScoreA - adjustedScoreB)

  // Regola differenza > 4pt: vittoria diretta indipendentemente dai gol
  if (diff > DIFF_THRESHOLD) {
    if (adjustedScoreA > adjustedScoreB) {
      return { resultA: 'W', resultB: 'L', pointsA: 3, pointsB: 0, rule: 'diff4' }
    } else {
      return { resultA: 'L', resultB: 'W', pointsA: 0, pointsB: 3, rule: 'diff4' }
    }
  }

  // Regola standard gol virtuali
  if (goalsA > goalsB) {
    return { resultA: 'W', resultB: 'L', pointsA: 3, pointsB: 0, rule: 'goals' }
  } else if (goalsA < goalsB) {
    return { resultA: 'L', resultB: 'W', pointsA: 0, pointsB: 3, rule: 'goals' }
  } else {
    return { resultA: 'D', resultB: 'D', pointsA: 1, pointsB: 1, rule: 'goals' }
  }
}

// ─── Calcolo giornata TvT ─────────────────────────────────────────────────────

/**
 * Calcola i risultati TvT per una giornata specifica.
 * Idempotente: sovrascrive i risultati esistenti.
 * 
 * @param {number} matchday - Numero giornata (1-38)
 * @param {string} [season] - Stagione (default: dalla config)
 * @returns {{ serieA: TvtResult[], serieB: TvtResult[] }}
 */
async function calculateMatchday(matchday, season = scraperConfig.season) {
  console.log(`[TvT] Calcolo giornata ${matchday} stagione ${season}...`)

  // 1. Carica le impostazioni lega per i gol virtuali
  const leagueSettings = await LeagueSettings.findOne({
    season,
    legaSlug: scraperConfig.legaSlug,
  })

  if (!leagueSettings) {
    throw new Error(
      `[TvT] Impostazioni lega non trovate per stagione ${season}. ` +
      'Esegui prima POST /api/scrape/init per inizializzare la lega.'
    )
  }

  const { punteggiBase, puntiPerGol } = leagueSettings
  console.log(`[TvT] Regole: base=${punteggiBase}, step=${puntiPerGol} pt/gol, soglia diff=${DIFF_THRESHOLD}pt`)

  // 2. Carica tutti i punteggi della giornata
  const matchdayScores = await MatchdayScore.find({ matchday, season }).populate('teamId')

  if (!matchdayScores.length) {
    throw new Error(
      `[TvT] Nessun punteggio trovato per giornata ${matchday}. ` +
      `Esegui prima POST /api/scrape/${matchday} per caricare i dati.`
    )
  }

  // 3. Raggruppa per serie, applica fattore campo
  const byPosition = { A: [], B: [] }
  for (const ms of matchdayScores) {
    const team = ms.teamId // populated
    if (!team) {
      console.warn(`[TvT] Squadra non trovata per MatchdayScore ${ms._id}`)
      continue
    }
    const { adjustedScore, homeAdjustment } = applyHomeAdjustment(ms.score, ms.isHome)
    const serie = team.serie
    if (!byPosition[serie]) byPosition[serie] = []
    byPosition[serie].push({
      team,
      score: ms.score,
      isHome: ms.isHome,
      homeAdjustment,
      adjustedScore,
      virtualGoals: calcVirtualGoals(adjustedScore, punteggiBase, puntiPerGol),
    })
  }

  const results = { serieA: [], serieB: [] }

  // 4. Per ogni serie, calcola tutti i confronti (N × N / 2 coppie)
  for (const serie of ['A', 'B']) {
    const serieTeams = byPosition[serie]

    if (!serieTeams || serieTeams.length < 2) {
      console.warn(`[TvT] Serie ${serie}: meno di 2 squadre (${serieTeams?.length || 0}). Skip.`)
      continue
    }

    console.log(`[TvT] Serie ${serie}: ${serieTeams.length} squadre, ${serieTeams.length * (serieTeams.length - 1) / 2} confronti`)

    // Mappa teamId → accumulatore risultati
    const accumulators = {}
    for (const entry of serieTeams) {
      accumulators[entry.team._id.toString()] = {
        team: entry.team,
        score: entry.score,
        isHome: entry.isHome,
        homeAdjustment: entry.homeAdjustment,
        adjustedScore: entry.adjustedScore,
        virtualGoals: entry.virtualGoals,
        wins: 0,
        draws: 0,
        losses: 0,
        tvtPoints: 0,
        matchups: [],
      }
    }

    // Log fattore campo applicato
    for (const entry of serieTeams) {
      const adj = entry.homeAdjustment !== 0 ? ` (🏠 casa: ${entry.score} → ${entry.adjustedScore})` : ''
      console.log(`  [${serie}] ${entry.team.name}: FP=${entry.score}${adj} GoV=${entry.virtualGoals}`)
    }

    // Confronta ogni coppia (i, j) con i < j
    for (let i = 0; i < serieTeams.length; i++) {
      for (let j = i + 1; j < serieTeams.length; j++) {
        const teamA = serieTeams[i]
        const teamB = serieTeams[j]

        const { resultA, resultB, pointsA, pointsB, rule } = determineResult(
          teamA.adjustedScore,
          teamB.adjustedScore,
          teamA.virtualGoals,
          teamB.virtualGoals,
        )

        const accA = accumulators[teamA.team._id.toString()]
        const accB = accumulators[teamB.team._id.toString()]

        // Aggiorna A
        if (resultA === 'W') accA.wins++
        else if (resultA === 'D') accA.draws++
        else accA.losses++
        accA.tvtPoints += pointsA
        accA.matchups.push({
          opponentId: teamB.team._id,
          opponentName: teamB.team.name,
          opponentScore: teamB.score,
          opponentAdjustedScore: teamB.adjustedScore,
          opponentVirtualGoals: teamB.virtualGoals,
          result: resultA,
          points: pointsA,
        })

        // Aggiorna B
        if (resultB === 'W') accB.wins++
        else if (resultB === 'D') accB.draws++
        else accB.losses++
        accB.tvtPoints += pointsB
        accB.matchups.push({
          opponentId: teamA.team._id,
          opponentName: teamA.team.name,
          opponentScore: teamA.score,
          opponentAdjustedScore: teamA.adjustedScore,
          opponentVirtualGoals: teamA.virtualGoals,
          result: resultB,
          points: pointsB,
        })

        // Log scontri significativi (regola diff4 applicata)
        if (rule === 'diff4') {
          console.log(`  ⚡ diff4: ${teamA.team.name}(${teamA.adjustedScore}) vs ${teamB.team.name}(${teamB.adjustedScore}) → diff=${Math.abs(teamA.adjustedScore - teamB.adjustedScore)} → ${resultA === 'W' ? teamA.team.name : teamB.team.name} vince`)
        }
      }
    }

    // 5. Salva/aggiorna TvtResult per ogni squadra
    const serieResults = []
    for (const acc of Object.values(accumulators)) {
      const tvtResult = await TvtResult.findOneAndUpdate(
        {
          teamId: acc.team._id,
          matchday,
          season,
        },
        {
          teamId: acc.team._id,
          teamName: acc.team.name,
          serie,
          matchday,
          season,
          fantaScore: acc.score,
          homeAdjustment: acc.homeAdjustment,
          adjustedScore: acc.adjustedScore,
          virtualGoals: acc.virtualGoals,
          wins: acc.wins,
          draws: acc.draws,
          losses: acc.losses,
          tvtPoints: acc.tvtPoints,
          matchups: acc.matchups,
        },
        { upsert: true, new: true }
      )
      serieResults.push(tvtResult)
    }

    results[`serie${serie}`] = serieResults

    // Log sommario
    serieResults
      .sort((a, b) => b.tvtPoints - a.tvtPoints)
      .forEach(r => {
        console.log(
          `  [${serie}] ${r.teamName.padEnd(25)} FP:${String(r.fantaScore).padStart(5)} ` +
          `GoV:${r.virtualGoals} W:${r.wins} D:${r.draws} L:${r.losses} TvT:${r.tvtPoints}pt`
        )
      })
  }

  console.log(`[TvT] ✅ Giornata ${matchday} calcolata`)
  return results
}

// ─── Classifica TvT ───────────────────────────────────────────────────────────

/**
 * Calcola la classifica TvT aggregata per una serie e stagione.
 * @param {string} serie - 'A' o 'B'
 * @param {string} [season] - Stagione
 * @returns {Array} Classifica con posizione, squadra, V/N/S, punti TvT, ecc.
 */
async function getStandings(serie, season = scraperConfig.season) {
  serie = serie.toUpperCase()

  // Aggrega i TvtResult per squadra
  const aggregated = await TvtResult.aggregate([
    { $match: { serie, season } },
    {
      $group: {
        _id: '$teamId',
        teamName: { $last: '$teamName' },
        totalTvtPoints: { $sum: '$tvtPoints' },
        totalWins: { $sum: '$wins' },
        totalDraws: { $sum: '$draws' },
        totalLosses: { $sum: '$losses' },
        matchdaysPlayed: { $sum: 1 },
        totalFantaScore: { $sum: '$fantaScore' },
        totalAdjustedScore: { $sum: '$adjustedScore' },
        avgFantaScore: { $avg: '$fantaScore' },
        avgAdjustedScore: { $avg: '$adjustedScore' },
        totalVirtualGoals: { $sum: '$virtualGoals' },
        matchdays: {
          $push: {
            matchday: '$matchday',
            tvtPoints: '$tvtPoints',
            fantaScore: '$fantaScore',
            virtualGoals: '$virtualGoals',
            wins: '$wins',
            draws: '$draws',
            losses: '$losses',
          },
        },
      },
    },
    {
      $sort: {
        totalTvtPoints: -1, // 1° criterio: punti TvT
        totalWins: -1, // 2° criterio: vittorie
        totalVirtualGoals: -1, // 3° criterio: gol virtuali totali
        avgFantaScore: -1, // 4° criterio: media fantapunteggio
      },
    },
  ])

  // Aggiunge posizione in classifica
  return aggregated.map((team, index) => ({
    position: index + 1,
    teamId: team._id,
    teamName: team.teamName,
    serie,
    season,
    totalTvtPoints: team.totalTvtPoints,
    totalWins: team.totalWins,
    totalDraws: team.totalDraws,
    totalLosses: team.totalLosses,
    matchdaysPlayed: team.matchdaysPlayed,
    totalMatchesPlayed: team.totalMatchesPlayed,
    totalFantaScore: Math.round(team.totalFantaScore * 100) / 100,
    avgFantaScore: Math.round(team.avgFantaScore * 100) / 100,
    totalAdjustedScore: Math.round(team.totalAdjustedScore * 100) / 100,
    avgAdjustedScore: Math.round(team.avgAdjustedScore * 100) / 100,
    totalVirtualGoals: team.totalVirtualGoals,
    matchdays: team.matchdays.sort((a, b) => a.matchday - b.matchday),
  }))
}

// ─── Risultati di una giornata ────────────────────────────────────────────────

/**
 * Restituisce i risultati TvT di una giornata specifica.
 * @param {number} matchday
 * @param {string} [serie] - 'A', 'B' o null per entrambe
 * @param {string} [season]
 * @returns {Object} { serieA: [], serieB: [] }
 */
async function getMatchdayResults(matchday, serie = null, season = scraperConfig.season) {
  const query = { matchday, season }
  if (serie) query.serie = serie.toUpperCase()

  const results = await TvtResult.find(query)
    .populate('teamId', 'name serie leagueTeamId ownerName')
    .sort({ serie: 1, tvtPoints: -1 })

  const grouped = { A: [], B: [] }
  for (const r of results) {
    grouped[r.serie].push(r)
  }

  return {
    matchday,
    season,
    serieA: grouped.A,
    serieB: grouped.B,
  }
}

// ─── Recupera ultima giornata calcolata ───────────────────────────────────────

/**
 * Restituisce l'ultima giornata per cui esistono TvtResult nel DB.
 * @param {string} [season]
 * @returns {number} Numero giornata (0 se nessuna)
 */
async function getLastCalculatedMatchday(season = scraperConfig.season) {
  const result = await TvtResult.findOne({ season })
    .sort({ matchday: -1 })
    .select('matchday')

  return result?.matchday || 0
}

// ─── Calcola tutte le giornate disponibili ────────────────────────────────────

/**
 * Calcola/ricalcola tutte le giornate per cui esistono MatchdayScore nel DB.
 * @param {string} [season]
 * @returns {Array<number>} Lista giornate calcolate
 */
async function calculateAllMatchdays(season = scraperConfig.season) {
  // Trova tutte le giornate distinte con punteggi
  const matchdays = await MatchdayScore.distinct('matchday', { season })
  matchdays.sort((a, b) => a - b)

  console.log(`[TvT] Ricalcolo di ${matchdays.length} giornate: ${matchdays.join(', ')}`)

  const calculated = []
  for (const matchday of matchdays) {
    try {
      await calculateMatchday(matchday, season)
      calculated.push(matchday)
    } catch (err) {
      console.error(`[TvT] Errore giornata ${matchday}:`, err.message)
    }
  }

  return calculated
}

module.exports = {
  calcVirtualGoals,
  determineResult,
  calculateMatchday,
  getStandings,
  getMatchdayResults,
  getLastCalculatedMatchday,
  calculateAllMatchdays,
}
