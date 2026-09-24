/**
 * Configurazione dello scraper per leghe.fantacalcio.it
 * Le API interne del sito Angular usano:
 *  - baseURL: https://apileague.fantacalcio.it
 *  - app_key header statica dell'app Angular
 *  - Bearer token ottenuto dopo login
 *  - URL pattern: {baseUrl}/{microserviceName}/{version}/{serviceName}{path}
 */

module.exports = {
  // URL base dell'API REST interna del sito
  apiBaseUrl: 'https://apileague.fantacalcio.it',

  // URL legacy per funzioni PHP originali (export CSV/Excel ecc.)
  legacyApiBaseUrl: 'https://leghe.fantacalcio.it/servizi',

  // Chiave pubblica dell'app Angular — hardcoded nel bundle frontend
  // Non è un segreto — è visibile a chiunque analizzi il JS
  appKey: 'ICiELOObd5DF5uJEATi77CRvHiiRuMU0',

  // Versione API
  apiVersion: 'v1',

  // Slug della lega su leghe.fantacalcio.it (dal .env)
  legaSlug: process.env.FC_LEGA_SLUG || 'lega-liz-zar',

  // Credenziali di accesso (dal .env — mai hardcoded)
  username: process.env.FC_USERNAME,
  password: process.env.FC_PASSWORD,

  // Stagione corrente (es. "2025-26")
  season: process.env.FC_SEASON || (() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    return month >= 7 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`
  })(),

  // Timeout per le richieste HTTP (ms)
  requestTimeout: 15000,

  // Numero di retry in caso di errore temporaneo
  maxRetries: 3,

  // Delay tra i retry (ms)
  retryDelay: 2000,
}
