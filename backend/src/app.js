require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

// ─── Crea app Express ─────────────────────────────────────────────────────────
const app = express()

// ─── Security & Logging ───────────────────────────────────────────────────────
app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(
  cors({
    origin: [corsOrigin, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
)

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Health checks (senza auth) ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Tutti vs Tutti API — Legazzate 2.0',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// ─── Routes API ───────────────────────────────────────────────────────────────
const standingsRouter = require('./routes/standings')
const matchdayRouter = require('./routes/matchday')
const teamsRouter = require('./routes/teams')
const adminRouter = require('./routes/admin')

app.use('/api/standings', standingsRouter)
app.use('/api/matchday', matchdayRouter)
app.use('/api/teams', teamsRouter)
app.use('/api', adminRouter)

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} non trovata` })
})

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message)

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({ success: false, message: messages.join(', ') })
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'campo'
    return res.status(400).json({ success: false, message: `Valore duplicato per ${field}` })
  }

  const statusCode = err.statusCode || err.status || 500
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Errore interno del server',
  })
})

module.exports = app
