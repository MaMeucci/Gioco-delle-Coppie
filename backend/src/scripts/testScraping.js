#!/usr/bin/env node
/**
 * testScraping.js
 * 
 * Script di test per esplorare le API di leghe.fantacalcio.it con credenziali reali.
 * Esegui con: node src/scripts/testScraping.js
 * 
 * Prerequisiti:
 *   1. Copia .env.example in .env
 *   2. Configura FC_USERNAME, FC_PASSWORD, FC_LEGA_SLUG
 *   3. npm install
 */

require('dotenv').config()
const axios = require('axios')

const APP_KEY = 'ICiELOObd5DF5uJEATi77CRvHiiRuMU0'
const BASE = 'https://apileague.fantacalcio.it'
const LEGA_SLUG = process.env.FC_LEGA_SLUG || 'lega-liz-zar'

async function main() {
  // ── 1. VALIDAZIONE CREDENZIALI ─────────────────────────────────────────────
  const { FC_USERNAME, FC_PASSWORD } = process.env
  if (!FC_USERNAME || !FC_PASSWORD) {
    console.error('❌ FC_USERNAME e FC_PASSWORD non configurati nel file .env')
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════════')
  console.log(' TEST SCRAPING — leghe.fantacalcio.it')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`Utente: ${FC_USERNAME}`)
  console.log(`Lega slug: ${LEGA_SLUG}`)
  console.log()

  const client = axios.create({
    baseURL: BASE,
    headers: {
      app_key: APP_KEY,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    timeout: 15000,
  })

  // ── 2. LOGIN ───────────────────────────────────────────────────────────────
  console.log('1. Testing LOGIN...')
  let token
  try {
    const res = await client.post('/onboarding/v1/login', {
      username: FC_USERNAME,
      password: FC_PASSWORD,
    })
    token = res.data.token
    console.log('✅ Login riuscito')
    console.log('   Token (primi 50 char):', token?.substring(0, 50))
    console.log('   Campi risposta:', Object.keys(res.data).join(', '))
    console.log()
  } catch (e) {
    console.error('❌ Login fallito:', e.response?.data || e.message)
    process.exit(1)
  }

  // Aggiunge il token a tutte le request successive
  client.defaults.headers.authorization = `Bearer ${token}`

  // ── 3. LEGHE DELL'UTENTE ───────────────────────────────────────────────────
  console.log('2. Recupero leghe utente...')
  let leagueId
  try {
    const res = await client.get('/onboarding/v1/my')
    const data = res.data
    console.log('✅ Leghe ottenute')
    console.log('   Struttura risposta:', JSON.stringify(data).substring(0, 500))

    const leagues = Array.isArray(data) ? data : (data.leagues || data.items || [])
    console.log(`   Numero leghe: ${leagues.length}`)

    leagues.forEach((l, i) => {
      console.log(`   [${i}] id=${l.id} alias=${l.alias} name=${l.name} slug=${l.slug}`)
    })

    const lega = leagues.find(l =>
      l.alias === LEGA_SLUG || l.slug === LEGA_SLUG
    )

    if (lega) {
      leagueId = lega.id || lega.leagueId
      console.log(`✅ Lega trovata! leagueId = ${leagueId}`)
    } else {
      console.warn('⚠️  Lega non trovata per slug:', LEGA_SLUG)
      console.warn('   Usa uno degli alias/slug mostrati sopra')
    }
    console.log()
  } catch (e) {
    console.error('❌ Errore leghe:', e.response?.status, e.response?.data || e.message)
    console.log()
  }

  if (!leagueId) {
    console.error('❌ Impossibile continuare senza leagueId')
    process.exit(1)
  }

  // ── 4. IMPOSTAZIONI LEGA ──────────────────────────────────────────────────
  console.log('3. Recupero impostazioni lega...')
  const settingsEndpoints = [
    { path: '/gaming/v1/league/settings', headers: { leagueid: leagueId } },
    { path: '/onboarding/v1/league/settings', headers: { leagueid: leagueId } },
  ]

  for (const { path, headers } of settingsEndpoints) {
    try {
      const res = await client.get(path, { headers })
      console.log(`✅ ${path}:`)
      console.log('   ', JSON.stringify(res.data).substring(0, 600))
      console.log()
    } catch (e) {
      console.log(`❌ ${path}: ${e.response?.status} ${JSON.stringify(e.response?.data).substring(0, 200)}`)
    }
  }

  // ── 5. SQUADRE ────────────────────────────────────────────────────────────
  console.log('4. Recupero squadre...')
  const teamsEndpoints = [
    { path: '/gaming/v1/league/teams', headers: { leagueid: leagueId } },
    { path: '/onboarding/v1/league/teams', headers: { leagueid: leagueId } },
    { path: '/gaming/v1/league/competition/teams', headers: { leagueid: leagueId } },
  ]

  for (const { path, headers } of teamsEndpoints) {
    try {
      const res = await client.get(path, { headers })
      console.log(`✅ ${path}:`)
      console.log('   ', JSON.stringify(res.data).substring(0, 800))
      console.log()
    } catch (e) {
      console.log(`❌ ${path}: ${e.response?.status} ${JSON.stringify(e.response?.data).substring(0, 200)}`)
    }
  }

  // ── 6. PUNTEGGI GIORNATA ──────────────────────────────────────────────────
  console.log('5. Recupero punteggi giornata 1...')
  const lineupEndpoints = [
    { path: `/gaming/v1/teamLineup/visualizza/${leagueId}/1`, headers: { leagueid: leagueId } },
    { path: `/gaming/v1/teamLineup/visualizza/${leagueId}/1`, headers: {} },
  ]

  for (const { path, headers } of lineupEndpoints) {
    try {
      const res = await client.get(path, { headers })
      console.log(`✅ ${path}:`)
      console.log('   ', JSON.stringify(res.data).substring(0, 1000))
      console.log()
    } catch (e) {
      console.log(`❌ ${path}: ${e.response?.status} ${JSON.stringify(e.response?.data).substring(0, 200)}`)
    }
  }

  // ── 7. PROFILO UTENTE ────────────────────────────────────────────────────
  console.log('6. Profilo utente (refresh token)...')
  try {
    const res = await client.get('/onboarding/v1/profile/my')
    console.log('✅ Profilo:', JSON.stringify(res.data).substring(0, 300))
    console.log()
  } catch (e) {
    console.log('❌ Profilo:', e.response?.status, JSON.stringify(e.response?.data).substring(0, 200))
  }

  // ── 8. REFRESH TOKEN ──────────────────────────────────────────────────────
  console.log('7. Test refresh token...')
  try {
    const res = await client.get('/onboarding/v1/refresh')
    console.log('✅ Refresh:', JSON.stringify(res.data).substring(0, 200))
  } catch (e) {
    console.log('❌ Refresh:', e.response?.status, JSON.stringify(e.response?.data).substring(0, 200))
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log(' TEST COMPLETATO')
  console.log('═══════════════════════════════════════════════════════')
  console.log()
  console.log('📋 AZIONI SUCCESSIVE:')
  console.log('1. Analizza l\'output sopra per capire la struttura dei dati')
  console.log('2. Adatta i campi in scrapingService.js se necessario')
  console.log('3. Nota il campo "serie/division" nelle squadre per mappare A/B')
  console.log('4. Nota i campi punteggio (score, punti, totalScore) nelle formazioni')
  console.log('5. Nota i campi impostazioni gol (goalThreshold, thresholdBase, ecc.)')
}

main().catch(e => {
  console.error('Errore fatale:', e.message)
  process.exit(1)
})
