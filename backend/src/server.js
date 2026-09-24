require('dotenv').config()
const app = require('./app')
const { connectDB } = require('./config/database')

const PORT = process.env.PORT || 3001

const { startCronJob } = require('./jobs/scheduledUpdate')

async function startServer() {
  try {
    // Connessione al database
    await connectDB()

    // Avvia il cron job di aggiornamento automatico (solo in produzione)
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
      startCronJob()
    }

    // Avvia il server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] ✅ Tutti vs Tutti API in ascolto su porta ${PORT}`)
      console.log(`[Server] Ambiente: ${process.env.NODE_ENV || 'development'}`)
      console.log(`[Server] Lega: ${process.env.FC_LEGA_SLUG || 'non configurata'}`)
      console.log(`[Server] Stagione: ${process.env.FC_SEASON || 'auto-detect'}`)
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] ❌ Porta ${PORT} già in uso. Esegui: kill $(lsof -ti:${PORT})`)
        process.exit(1)
      } else {
        throw err
      }
    })

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n[Server] Ricevuto ${signal}, chiusura in corso...`)
      server.close(async () => {
        const { disconnectDB } = require('./config/database')
        await disconnectDB()
        console.log('[Server] Server chiuso correttamente')
        process.exit(0)
      })

      // Forza chiusura dopo 10 secondi
      setTimeout(() => {
        console.error('[Server] Timeout graceful shutdown, forza chiusura')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

    return server
  } catch (err) {
    console.error('[Server] Errore avvio:', err.message)
    process.exit(1)
  }
}

startServer()
