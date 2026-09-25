/**
 * scrapingService.js
 *
 * Servizio per il recupero autenticato dei dati dalla lega su leghe.fantacalcio.it
 *
 * Endpoint API verificati con reverse engineering (09/2026):
 *   Login:          POST https://apileague.fantacalcio.it/onboarding/v1/login
 *   Squadre:        GET  https://apileague.fantacalcio.it/onboarding/v1/league/teams?page=1
 *   Competizioni:   GET  https://apileague.fantacalcio.it/onboarding/v1/league/competitions
 *   Status lega:    GET  https://apileague.fantacalcio.it/onboarding/v1/league/status
 *   Settings:       GET  https://apileague.fantacalcio.it/onboarding/v1/league/settings
 *   Punteggi:       GET  https://leghe.fantacalcio.it/servizi/v1_legheCompetizione/classificagiornate
 *                        ?alias_lega={slug}&id_competizione={id}&giornata_inizio={n}&giornata_fine={n}
 *
 * Auth: il JWT della lega va come Bearer token + l'app_key come header
 *
 * NOTA STRUTTURA LEGAZZATE-2:
 *   Le due serie NON sono identificate dal campo "d" nelle squadre (tutte = "A").
 *   Sono invece due competizioni di tipo 1 (Campionato) separate:
 *     - "Campionato SerieA"  id=336979  → 10 tmids
 *     - "Campionato Serie B" id=337020  → 10 tmids diversi
 *   La serie di ogni squadra si ricava dal campo tmids di ciascuna competizione.
 */

const axios = require('axios')
const tough = require('tough-cookie')
const { wrapper } = require('axios-cookiejar-support')
const scraperConfig = require('../config/scraper')
const { LeagueSettings, Team, MatchdayScore } = require('../models')

// ─── Stato della sessione (in-memory) ────────────────────────────────────────

// Jar di cookie condiviso per le chiamate al legacy endpoint (servizi/)
const cookieJar = new tough.CookieJar()

let sessionState = {
  token: null,
  tokenExpiresAt: null,
  leagueId: null,
  competitionId: null,      // ID campionato Serie A (tipo 1, nome contiene "A")
  competitionIdB: null,     // ID campionato Serie B (tipo 1, nome contiene "B")
  allLeagues: [],
  allCompetitions: [],
  // Mappa leagueTeamId → serie ("A" | "B"), costruita da tmids nelle competizioni
  teamSerieMap: {},
  legacyCookiesReady: false,
}

// ─── Client HTTP ──────────────────────────────────────────────────────────────

function createApiClient(token = null) {
  const headers = {
    app_key: scraperConfig.appKey,
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (token) headers.authorization = `Bearer ${token}`
  return axios.create({ baseURL: scraperConfig.apiBaseUrl, headers, timeout: scraperConfig.requestTimeout })
}

// Il legacy endpoint classificagiornate richiede il cookie FCLeague2026 (HttpOnly).
// Il cookie viene ottenuto tramite login al sito legacy PHP.
function createLegacyClient() {
  const instance = wrapper(axios.create({
    baseURL: scraperConfig.legacyApiBaseUrl,
    headers: {
      app_key: scraperConfig.appKey,
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
      referer: `https://leghe.fantacalcio.it/${scraperConfig.legaSlug}/`,
      origin: 'https://leghe.fantacalcio.it',
    },
    timeout: scraperConfig.requestTimeout,
    withCredentials: true,
  }))
  instance.defaults.jar = cookieJar
  return instance
}

// ─── Retry ────────────────────────────────────────────────────────────────────

async function withRetry(fn, retries = scraperConfig.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err.response?.status
      if (status === 401 || status === 403 || status === 404) throw err
      if (attempt === retries) throw err
      const delay = scraperConfig.retryDelay * attempt
      console.warn(`[Scraper] Tentativo ${attempt} fallito (${status || err.message}). Retry in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login() {
  const { username, password } = scraperConfig
  if (!username || !password) {
    throw new Error('[Scraper] FC_USERNAME e FC_PASSWORD devono essere configurati nel file .env')
  }

  console.log(`[Scraper] Login come ${username}...`)
  const client = createApiClient()

  const response = await withRetry(() =>
    client.post('/onboarding/v1/login', { username, password })
  )

  // Struttura reale: { success: true, data: { jwt, leghe: [{ id, alias, jwt, ... }], utente } }
  const inner = response.data?.data
  if (!inner?.jwt) {
    throw new Error(`[Scraper] Login fallito: ${JSON.stringify(response.data).substring(0, 200)}`)
  }

  const legaSlug = scraperConfig.legaSlug
  const legaData = inner.leghe?.find(l => l.alias === legaSlug)

  if (legaData) {
    sessionState.leagueId = legaData.id
    sessionState.token = legaData.jwt   // JWT specifico della lega (ruolo user_league)
    console.log(`[Scraper] Lega trovata: id=${legaData.id}, alias=${legaData.alias}`)
  } else {
    sessionState.token = inner.jwt
    const available = inner.leghe?.map(l => l.alias).join(', ')
    throw new Error(`[Scraper] Lega "${legaSlug}" non trovata. Leghe disponibili: ${available}`)
  }

  sessionState.allLeagues = inner.leghe || []
  sessionState.tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000)

  console.log(`[Scraper] Login OK. LeagueId=${sessionState.leagueId}`)
  return sessionState.token
}

// ─── Cookie legacy (FCLeague2026) ────────────────────────────────────────────

/**
 * Ottiene il cookie FCLeague2026 automaticamente tramite login.
 * Il cookie viene restituito nell'header Set-Cookie dalla risposta di login
 * dell'endpoint /onboarding/v1/login — non serve un browser.
 * Scade ogni ~8 giorni ma viene riottenuto automaticamente ad ogni avvio.
 */
async function loginLegacy() {
  if (sessionState.legacyCookiesReady) return

  const legacyBaseUrl = 'https://leghe.fantacalcio.it'
  const slug = scraperConfig.legaSlug

  // Prima prova: usa il cookie salvato in .env (fallback manuale)
  const savedCookie = process.env.FC_LEGACY_COOKIE
  if (savedCookie) {
    try {
      await cookieJar.setCookie(
        `FCLeague2026=${savedCookie}; Domain=.fantacalcio.it; Path=/; Secure; SameSite=None`,
        legacyBaseUrl
      )
      sessionState.legacyCookiesReady = true
      console.log('[Scraper] Cookie FCLeague2026 caricato da FC_LEGACY_COOKIE ✅')
      return
    } catch (e) {
      console.warn('[Scraper] Errore caricamento cookie da .env:', e.message)
    }
  }

  // Seconda prova: ottieni il cookie automaticamente dal login
  console.log('[Scraper] FC_LEGACY_COOKIE non configurato — ottengo cookie via login automatico...')
  try {
    const { username, password } = scraperConfig
    if (!username || !password) {
      console.warn('[Scraper] ⚠️  FC_USERNAME/FC_PASSWORD non configurati — impossibile ottenere cookie')
      return
    }

    // Usa axios con cookie jar per catturare il Set-Cookie dal login
    const loginClient = wrapper(axios.create({
      baseURL: scraperConfig.apiBaseUrl,
      jar: cookieJar,
      withCredentials: true,
      timeout: scraperConfig.requestTimeout,
      headers: { app_key: scraperConfig.appKey, 'Content-Type': 'application/json' },
    }))

    await loginClient.post('/onboarding/v1/login', { username, password })

    // Il cookie jar ha ora FCLeague2026 dal Set-Cookie della risposta
    const cookies = await cookieJar.getCookies(legacyBaseUrl)
    const fcCookie = cookies.find(c => c.key === 'FCLeague2026')

    if (fcCookie) {
      // Salva in memoria per i prossimi usi
      process.env.FC_LEGACY_COOKIE = fcCookie.value
      sessionState.legacyCookiesReady = true
      console.log('[Scraper] Cookie FCLeague2026 ottenuto automaticamente via login ✅')
    } else {
      // Il cookie potrebbe essere su dominio diverso — controlla apileague
      const cookiesApi = await cookieJar.getCookies('https://apileague.fantacalcio.it')
      const fcCookieApi = cookiesApi.find(c => c.key === 'FCLeague2026')
      if (fcCookieApi) {
        // Re-inietta sul dominio corretto per le chiamate legacy
        await cookieJar.setCookie(
          `FCLeague2026=${fcCookieApi.value}; Domain=.fantacalcio.it; Path=/; Secure; SameSite=None`,
          legacyBaseUrl
        )
        process.env.FC_LEGACY_COOKIE = fcCookieApi.value
        sessionState.legacyCookiesReady = true
        console.log('[Scraper] Cookie FCLeague2026 re-iniettato da apileague ✅')
      } else {
        console.warn('[Scraper] ⚠️  Cookie FCLeague2026 non trovato dopo login — classificagiornate potrebbe fallire')
      }
    }
  } catch (e) {
    console.warn('[Scraper] Errore login automatico per cookie:', e.message)
  }
}

/**
 * Aggiorna il cookie FCLeague2026 nel jar (chiamato dall'admin endpoint)
 */
async function updateLegacyCookie(cookieValue) {
  const legacyBaseUrl = 'https://leghe.fantacalcio.it'
  const slug = scraperConfig.legaSlug
  // Reset jar e re-inietta
  await cookieJar.removeAllCookies()
  await cookieJar.setCookie(
    `FCLeague2026=${cookieValue}; Domain=.fantacalcio.it; Path=/; Secure; SameSite=None`,
    legacyBaseUrl
  )
  await cookieJar.setCookie(
    `comp_${slug}_FCLeague2026=0=336979; Domain=.fantacalcio.it; Path=/; Secure; SameSite=None`,
    legacyBaseUrl
  )
  sessionState.legacyCookiesReady = true
  // Aggiorna anche la variabile d'ambiente in memoria
  process.env.FC_LEGACY_COOKIE = cookieValue
  console.log('[Scraper] Cookie FCLeague2026 aggiornato ✅')
}

// ─── Sessione ─────────────────────────────────────────────────────────────────

function isTokenValid() {
  if (!sessionState.token || !sessionState.tokenExpiresAt) return false
  return sessionState.tokenExpiresAt.getTime() - Date.now() > 5 * 60 * 1000
}

async function getAuthClient() {
  if (!isTokenValid()) await login()
  return createApiClient(sessionState.token)
}

async function getLeagueId() {
  if (!isTokenValid()) await login()
  return sessionState.leagueId
}

// ─── Status lega (giornata corrente) ─────────────────────────────────────────

/**
 * Restituisce lo stato corrente della lega: ultima giornata disponibile.
 * Risposta reale: { sto: false, activ: true, sId: 21, mday: 6, mstr: "2026-10-10T13:00:00" }
 */
async function getLeagueStatus() {
  const client = await getAuthClient()
  const response = await withRetry(() => client.get('/onboarding/v1/league/status'))
  return response.data
}

// ─── Competizioni ─────────────────────────────────────────────────────────────

/**
 * Recupera la lista delle competizioni della lega.
 * Identifica le due competizioni Campionato (tipo 1) per Serie A e Serie B.
 *
 * La struttura di legazzate-2:
 *   - "Campionato SerieA"  → type=1, name contiene "A" (senza spazio)
 *   - "Campionato Serie B" → type=1, name contiene "B"
 *
 * Costruisce anche la mappa teamSerieMap: { leagueTeamId → "A"|"B" }
 */
async function getCompetitions() {
  if (sessionState.competitionId) {
    return {
      competitionId: sessionState.competitionId,
      competitionIdB: sessionState.competitionIdB,
      teamSerieMap: sessionState.teamSerieMap,
      all: sessionState.allCompetitions,
    }
  }

  const client = await getAuthClient()
  const response = await withRetry(() => client.get('/onboarding/v1/league/competitions'))
  const comps = Array.isArray(response.data) ? response.data : []

  sessionState.allCompetitions = comps
  console.log('[Scraper] Competizioni trovate:', comps.map(c => `${c.id}:"${c.name}"(type=${c.type})`).join(' | '))

  // Filtra i campionati (type=1) non eliminati
  const campionati = comps.filter(c => c.type === 1 && !c.del)

  if (!campionati.length) throw new Error('[Scraper] Nessun Campionato (type=1) trovato nella lega')

  // Identifica Serie A e Serie B per nome
  // Convenzione: il nome con "B" (maiuscolo) o "Serie B" → B, altrimenti → A
  const campA = campionati.find(c => /serie\s*a/i.test(c.name)) || campionati[0]
  const campB = campionati.find(c => /serie\s*b/i.test(c.name)) || campionati[1] || null

  sessionState.competitionId = campA.id
  sessionState.competitionIdB = campB?.id || null

  console.log(`[Scraper] Campionato Serie A: id=${campA.id}, name="${campA.name}"`)
  if (campB) console.log(`[Scraper] Campionato Serie B: id=${campB.id}, name="${campB.name}"`)
  else console.log('[Scraper] Nessun Campionato Serie B trovato — lega a serie singola')

  // Costruisce la mappa teamId → serie dai tmids delle competizioni
  const teamSerieMap = {}
  ;(campA.tmids || []).forEach(id => { teamSerieMap[String(id)] = 'A' })
  ;(campB?.tmids || []).forEach(id => { teamSerieMap[String(id)] = 'B' })
  sessionState.teamSerieMap = teamSerieMap

  console.log(`[Scraper] teamSerieMap costruita: A=${Object.values(teamSerieMap).filter(v => v === 'A').length} squadre, B=${Object.values(teamSerieMap).filter(v => v === 'B').length} squadre`)

  return {
    competitionId: campA.id,
    competitionIdB: campB?.id || null,
    teamSerieMap,
    all: comps,
  }
}

// ─── Impostazioni lega ────────────────────────────────────────────────────────

/**
 * Recupera le impostazioni della lega (bonus/malus gol, soglie ecc.)
 * e salva/aggiorna LeagueSettings nel DB.
 */
async function getLeagueSettings() {
  const client = await getAuthClient()

  // Recupera settings, status e calendario in parallelo
  const [settingsRes, competitionInfo] = await Promise.all([
    withRetry(() => client.get('/onboarding/v1/league/settings')),
    getCompetitions(),
  ])
  const { competitionId } = competitionInfo

  const raw = settingsRes.data
  console.log('[Scraper] Settings raw (primo 200 char):', JSON.stringify(raw).substring(0, 200))

  // Estrae soglie gol virtuali da lcnps (league competition points settings)
  let punteggiBase = 60
  let puntiPerGol = 6

  const lcnps = raw.lcnps
  if (lcnps) {
    const sections = Object.values(lcnps).filter(v => typeof v === 'object' && v !== null)
    for (const s of sections) {
      if (s?.goalThreshold?.base !== undefined) {
        punteggiBase = s.goalThreshold.base
        puntiPerGol = s.goalThreshold.step || 6
        console.log(`[Scraper] goalThreshold trovato: base=${punteggiBase}, step=${puntiPerGol}`)
        break
      }
    }
    if (lcnps.goalThreshold?.base !== undefined) {
      punteggiBase = lcnps.goalThreshold.base
      puntiPerGol = lcnps.goalThreshold.step || 6
    }
  }

  // ─── Calcolo lastAvailableMatchday dalla calendario ───────────────────────
  // mday nell'API status = la PROSSIMA giornata di Serie A da giocare (non l'ultima giocata).
  // mstr = data/ora in cui si giocherà la prossima giornata.
  // L'unica fonte affidabile per sapere quante giornate INTERNE sono già calcolate
  // è il campo "calculated: true" nel calendario della competizione.
  let lastAvailableMatchday = 0
  let nextMatchday = null
  let nextMatchdayDate = null

  try {
    const calRes = await withRetry(() =>
      client.get(`/onboarding/v1/league/competition/calendar/${competitionId}`)
    )
    const rounds = Array.isArray(calRes.data) ? calRes.data
                 : (calRes.data?.rounds || calRes.data?.data || Object.values(calRes.data || {}))

    if (Array.isArray(rounds)) {
      // Conta le giornate con calculated=true (già giocate e calcolate)
      const calculatedRounds = rounds.filter(r => r.calculated === true)
      lastAvailableMatchday = calculatedRounds.length

      // Identifica la prossima giornata non ancora calcolata
      const nextRound = rounds.find(r => r.calculated === false)
      if (nextRound) {
        nextMatchday = nextRound.matchDay
        // La data si ricava dalle partite (tIdH/tIdA) o dallo status
      }

      console.log(`[Scraper] Calendario: ${rounds.length} giornate totali, ${lastAvailableMatchday} già calcolate`)
      rounds.forEach(r => console.log(`  Giornata interna ${r.matchDay} (SerieA ${r.championshipMatchDay}): calculated=${r.calculated}`))
    }
  } catch (e) {
    console.warn('[Scraper] Impossibile leggere calendario, fallback a 0:', e.message)
  }

  // Legge la data della prossima giornata dallo status (mday/mstr)
  try {
    const statusData = await getLeagueStatus()
    // mday = prossima giornata di Serie A, mstr = data/ora
    nextMatchdayDate = statusData?.mstr ? new Date(statusData.mstr) : null
    console.log(`[Scraper] Prossima giornata Serie A: ${statusData?.mday} (${statusData?.mstr})`)
  } catch (e) {
    console.warn('[Scraper] Impossibile leggere status:', e.message)
  }

  const competitionStartDay = competitionInfo?.all?.find(c => c.id === competitionId)?.sDay || 1

  const settings = {
    punteggiBase,
    puntiPerGol,
    totalMatchdays: 38,
    lastAvailableMatchday,        // Giornate interne già CALCOLATE (calculated=true nel calendario)
    competitionStartDay,          // Prima giornata di Serie A della competizione
    nextMatchdayDate,             // Data/ora prossima giornata
    rawSettings: raw,
    legaSlug: scraperConfig.legaSlug,
    season: scraperConfig.season,
    lastScrapedAt: new Date(),
  }

  await LeagueSettings.findOneAndUpdate(
    { season: scraperConfig.season, legaSlug: scraperConfig.legaSlug },
    settings,
    { upsert: true, new: true }
  )

  console.log(`[Scraper] Impostazioni: base=${punteggiBase}, step=${puntiPerGol} pt/gol, giornate interne calcolate=${lastAvailableMatchday}`)
  return settings
}

// ─── Squadre ──────────────────────────────────────────────────────────────────

/**
 * Recupera tutte le squadre della lega e le salva nel DB.
 *
 * Usa l'endpoint competition/teams per entrambe le serie (A e B):
 *   GET /onboarding/v1/league/competition/teams?competitionId={id}
 * che restituisce i nomi corretti per tutte le squadre.
 */
async function getLeagueTeams() {
  const client = await getAuthClient()

  // Assicura che la mappa serie sia costruita
  const { teamSerieMap, competitionId, competitionIdB } = await getCompetitions()

  console.log('[Scraper] Recupero squadre per Serie A e Serie B...')

  // Recupera squadre di entrambe le competizioni in parallelo
  const [resA, resB] = await Promise.all([
    withRetry(() => client.get(`/onboarding/v1/league/competition/teams?page=1&pageSize=50&competitionId=${competitionId}`)),
    competitionIdB
      ? withRetry(() => client.get(`/onboarding/v1/league/competition/teams?page=1&pageSize=50&competitionId=${competitionIdB}`))
      : Promise.resolve({ data: { data: [] } }),
  ])

  const rawA = (resA.data?.data || [])
  const rawB = (resB.data?.data || [])

  if (!rawA.length && !rawB.length) throw new Error('[Scraper] Nessuna squadra trovata')

  console.log(`[Scraper] Squadre Serie A: ${rawA.length}, Serie B: ${rawB.length}`)

  // Costruisce array finale con la serie corretta dalla mappa
  const allRaw = [
    ...rawA.map(t => ({ ...t, _serie: 'A' })),
    ...rawB.map(t => ({ ...t, _serie: 'B' })),
  ]

  const teams = allRaw.map(t => ({
    leagueTeamId: String(t.id),
    name: t.n || t.name || `Squadra ${t.id}`,
    ownerName: t.nu || t.ownerName || null,
    // Usa la mappa serie per coerenza, fallback alla serie del endpoint
    serie: teamSerieMap[String(t.id)] || t._serie,
  }))

  console.log(`[Scraper] Totale squadre: ${teams.length} — A=${teams.filter(t => t.serie === 'A').length}, B=${teams.filter(t => t.serie === 'B').length}`)
  teams.forEach(t => console.log(`  [${t.serie}] id=${t.leagueTeamId} - ${t.name}`))

  // Upsert nel DB
  const ops = teams.map(t =>
    Team.findOneAndUpdate(
      { leagueTeamId: t.leagueTeamId, season: scraperConfig.season },
      { ...t, season: scraperConfig.season },
      { upsert: true, new: true }
    )
  )
  await Promise.all(ops)

  return teams
}

// ─── Punteggi giornata ────────────────────────────────────────────────────────

/**
 * Recupera i punteggi fantacalcio di tutte le squadre per una giornata.
 * Usa la legacy API: /servizi/v1_legheCompetizione/classificagiornate
 *
 * Risposta verificata: { success: true, data: [
 *   { id: teamId, g: giornate, p: puntiTvT, s_p: sommaFP, v, n, pr, gf, gs, gr: "A"|"B" }
 * ]}
 *
 * NOTA: "s_p" = somma punteggi, "g" = giornate giocate.
 *       Per una singola giornata usiamo giornata_inizio=giornata_fine=matchday.
 * @param {number} matchday
 * @returns {Array<{leagueTeamId, name, serie, score}>}
 */
/**
 * Recupera i punteggi di una giornata per ENTRAMBE le serie.
 * Chiama classificagiornate per il campionato A e per il campionato B separatamente,
 * poi unisce i risultati assegnando la serie corretta tramite teamSerieMap.
 */
async function getMatchdayScores(matchday) {
  if (!isTokenValid()) await login()
  const { competitionId, competitionIdB, teamSerieMap } = await getCompetitions()
  // Assicura che il cookie FCLeague2026 sia disponibile per il legacy endpoint
  await loginLegacy()
  const legacyClient = createLegacyClient()

  console.log(`[Scraper] Recupero punteggi giornata ${matchday}...`)

  // Funzione helper per una singola competizione
  async function fetchScoresForComp(compId, serieName) {
    const params = new URLSearchParams({
      alias_lega: scraperConfig.legaSlug,
      id_competizione: String(compId),
      giornata_inizio: String(matchday),
      giornata_fine: String(matchday),
    })
    try {
      const response = await withRetry(() =>
        legacyClient.get(`/v1_legheCompetizione/classificagiornate?${params}`)
      )
      const raw = response.data
      if (!raw.success || !raw.data?.length) {
        console.warn(`[Scraper] Nessun dato Serie ${serieName} giornata ${matchday}`)
        return []
      }
      return raw.data.map(s => ({
        leagueTeamId: String(s.id),
        // Usa la mappa serie per assegnare correttamente — ignora gr dell'API
        serie: teamSerieMap[String(s.id)] || serieName,
        score: Number(s.s_p || 0),
        virtualGoals: null,
      }))
    } catch (e) {
      console.warn(`[Scraper] Errore recupero punteggi Serie ${serieName}:`, e.message)
      return []
    }
  }

  // Recupera in parallelo Serie A e Serie B
  const [scoresA, scoresB] = await Promise.all([
    fetchScoresForComp(competitionId, 'A'),
    competitionIdB ? fetchScoresForComp(competitionIdB, 'B') : Promise.resolve([]),
  ])

  const scores = [...scoresA, ...scoresB]

  console.log(`[Scraper] Punteggi giornata ${matchday}: ${scores.length} squadre (A=${scoresA.length}, B=${scoresB.length})`)
  scores.forEach(s => console.log(`  [${s.serie}] id=${s.leagueTeamId} FP=${s.score}`))

  return scores
}

// ─── Salva punteggi nel DB ────────────────────────────────────────────────────

/**
 * Recupera dal calendario quali squadre giocano in casa per una giornata interna.
 * Restituisce una Map: leagueTeamId (stringa) → true (casa) | false (trasferta)
 */
/**
 * Estrae un array di rounds dalla risposta raw del calendario dell'API.
 * L'API può restituire varie strutture: array diretto, { rounds }, { data }, o oggetto indicizzato.
 * @param {*} raw - Dato grezzo restituito dall'API calendario
 * @returns {Array} Array di round objects (può essere vuoto)
 */
function extractRoundsFromCalendar(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.rounds)) return raw.rounds
  if (raw && Array.isArray(raw.data)) return raw.data
  if (raw && Array.isArray(raw.calendar)) return raw.calendar
  if (raw && typeof raw === 'object') {
    // Tenta estrazione da oggetto indicizzato: { "1": {...}, "2": {...} }
    const vals = Object.values(raw).filter(v => v && typeof v === 'object' && !Array.isArray(v))
    if (vals.length > 0 && (vals[0].matchDay !== undefined || vals[0].matches !== undefined || vals[0].tIdH !== undefined)) {
      return vals
    }
    // Oggetto con una sola chiave array
    for (const val of Object.values(raw)) {
      if (Array.isArray(val) && val.length > 0) return val
    }
  }
  return []
}

/**
 * Estrae home/away da un singolo round del calendario.
 * I match nel round possono essere in vari formati:
 *   - round.matches[] con { tIdH, tIdA }
 *   - round diretto con { tIdH, tIdA } (round IS a match)
 *   - round.partite[] o round.schedule[]
 * @param {Object} round
 * @param {Map} homeMap - mappa da aggiornare (leagueTeamId string → boolean)
 */
function extractMatchesFromRound(round, homeMap) {
  // Caso 1: il round ha un array di partite
  const matchList = round.matches || round.partite || round.schedule || round.games || []
  if (Array.isArray(matchList) && matchList.length > 0) {
    for (const m of matchList) {
      if (m.tIdH != null) homeMap.set(String(m.tIdH), true)
      if (m.tIdA != null) homeMap.set(String(m.tIdA), false)
    }
    return
  }

  // Caso 2: il round stesso è una partita (ha direttamente tIdH/tIdA)
  if (round.tIdH != null) homeMap.set(String(round.tIdH), true)
  if (round.tIdA != null) homeMap.set(String(round.tIdA), false)
}

async function getHomeAwayMap(matchday) {
  const homeMap = new Map()
  try {
    const client = await getAuthClient()
    const { competitionId, competitionIdB } = await getCompetitions()

    for (const compId of [competitionId, competitionIdB].filter(Boolean)) {
      const calRes = await withRetry(() =>
        client.get(`/onboarding/v1/league/competition/calendar/${compId}`)
      )

      // Log della struttura raw per diagnostica (solo prima volta)
      const rawSnippet = JSON.stringify(calRes.data).substring(0, 500)
      console.log(`[Scraper] Calendario raw compId=${compId} (prime 500 char): ${rawSnippet}`)

      const rounds = extractRoundsFromCalendar(calRes.data)
      console.log(`[Scraper] Calendario compId=${compId}: ${rounds.length} rounds estratti`)

      if (!rounds.length) {
        console.warn(`[Scraper] getHomeAwayMap: nessun round estratto per compId=${compId}`)
        continue
      }

      // Log struttura del primo round per diagnostica
      if (rounds[0]) {
        console.log(`[Scraper] Struttura primo round: ${JSON.stringify(rounds[0]).substring(0, 300)}`)
      }

      // Identifica il round corrispondente alla giornata interna 'matchday'
      // Le chiavi possibili: matchDay, mDay, giornata, day, round, roundNumber
      const round = rounds.find(r =>
        r.matchDay === matchday ||
        r.mDay === matchday ||
        r.giornata === matchday ||
        r.day === matchday ||
        r.round === matchday ||
        r.roundNumber === matchday
      )

      if (!round) {
        console.warn(`[Scraper] Giornata interna ${matchday} non trovata nel calendario compId=${compId}`)
        console.warn(`[Scraper] matchDay values disponibili: ${rounds.slice(0, 5).map(r => r.matchDay ?? r.mDay ?? r.giornata ?? r.day ?? JSON.stringify(r).substring(0, 50)).join(', ')}`)
        continue
      }

      console.log(`[Scraper] Round trovato per giornata ${matchday}: ${JSON.stringify(round).substring(0, 300)}`)
      extractMatchesFromRound(round, homeMap)
    }

    console.log(`[Scraper] Home/Away giornata ${matchday}: ${homeMap.size} squadre mappate`)
    if (homeMap.size > 0) {
      homeMap.forEach((isHome, teamId) =>
        console.log(`  id=${teamId}: ${isHome ? '🏠 casa' : '✈️  trasferta'}`)
      )
    }
  } catch (e) {
    console.warn(`[Scraper] Impossibile leggere calendario per fattore campo: ${e.message}`)
    console.warn(`[Scraper] Stack: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`)
  }
  return homeMap
}

/**
 * Recupera la struttura raw del calendario per una competizione.
 * Usato dall'endpoint debug per ispezione manuale.
 */
async function getRawCalendar(compId) {
  const client = await getAuthClient()
  const calRes = await withRetry(() =>
    client.get(`/onboarding/v1/league/competition/calendar/${compId}`)
  )
  return calRes.data
}

async function scrapeAndSaveMatchday(matchday) {
  const scores = await getMatchdayScores(matchday)
  if (!scores.length) return []

  // Recupera la mappa casa/trasferta dal calendario
  const homeMap = await getHomeAwayMap(matchday)

  const ops = scores.map(async (s) => {
    const team = await Team.findOne({ leagueTeamId: s.leagueTeamId, season: scraperConfig.season })
    if (!team) {
      console.warn(`[Scraper] Team ${s.leagueTeamId} non trovato nel DB`)
      return null
    }

    // isHome: true se la squadra gioca in casa questa giornata, false se in trasferta
    // null se il calendario non è disponibile
    const isHome = homeMap.has(s.leagueTeamId) ? homeMap.get(s.leagueTeamId) : null
    if (isHome !== null) {
      console.log(`[Scraper] ${team.name}: ${isHome ? '🏠 casa (-2pt)' : '✈️  trasferta'}`)
    }

    return MatchdayScore.findOneAndUpdate(
      { teamId: team._id, matchday, season: scraperConfig.season },
      {
        teamId: team._id,
        matchday,
        season: scraperConfig.season,
        score: s.score,
        isHome,
        virtualGoals: null,
        source: 'scraping',
        scrapedAt: new Date(),
      },
      { upsert: true, new: true }
    )
  })

  const results = (await Promise.all(ops)).filter(Boolean)
  console.log(`[Scraper] Salvati ${results.length} punteggi per giornata ${matchday}`)
  return results
}

// ─── Aggiorna solo isHome per una giornata già in DB ─────────────────────────

/**
 * Aggiorna il campo isHome dei MatchdayScore già salvati per una giornata,
 * senza modificare score o altri dati. Utile per correggere il fattore campo
 * dopo un primo scraping che non aveva ancora i dati casa/trasferta.
 * @param {number} matchday
 * @returns {Array<{teamName, isHome}>} Squadre aggiornate
 */
async function updateHomeAwayForMatchday(matchday) {
  const homeMap = await getHomeAwayMap(matchday)
  if (!homeMap.size) {
    console.warn(`[Scraper] updateHomeAwayForMatchday: homeMap vuota per giornata ${matchday}`)
    return []
  }

  const scores = await MatchdayScore.find({ matchday, season: scraperConfig.season }).populate('teamId')
  const updated = []

  for (const ms of scores) {
    const team = ms.teamId
    if (!team?.leagueTeamId) continue
    const isHome = homeMap.has(team.leagueTeamId) ? homeMap.get(team.leagueTeamId) : null
    if (isHome === ms.isHome) continue // nessun cambiamento

    ms.isHome = isHome
    await ms.save()
    updated.push({ teamName: team.name, leagueTeamId: team.leagueTeamId, isHome })
    console.log(`[Scraper] updateHomeAway: ${team.name} → ${isHome === null ? 'null' : isHome ? '🏠 casa' : '✈️  trasferta'}`)
  }

  console.log(`[Scraper] updateHomeAway giornata ${matchday}: ${updated.length} squadre aggiornate`)
  return updated
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initScraping() {
  console.log('[Scraper] === Inizializzazione ===')
  const settings = await getLeagueSettings()
  const teams = await getLeagueTeams()
  console.log('[Scraper] === Init completato ===')
  return { settings, teams }
}

// ─── Reset sessione ───────────────────────────────────────────────────────────

function resetSession() {
  sessionState = { token: null, tokenExpiresAt: null, leagueId: null, competitionId: null, allLeagues: [], allCompetitions: [] }
}

module.exports = {
  login,
  getLeagueId,
  getLeagueSettings,
  getLeagueTeams,
  getMatchdayScores,
  scrapeAndSaveMatchday,
  updateHomeAwayForMatchday,
  getHomeAwayMap,
  getRawCalendar,
  getCompetitions,
  initScraping,
  isTokenValid,
  resetSession,
  updateLegacyCookie,
}
