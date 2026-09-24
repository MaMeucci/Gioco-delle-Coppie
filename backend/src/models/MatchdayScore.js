const mongoose = require('mongoose')

const matchdayScoreSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    matchday: {
      type: Number,
      required: true,
      min: 1,
      max: 38,
    },
    season: {
      type: String,
      required: true,
    },
    // Punteggio fantacalcio grezzo (inclusi tutti i bonus/malus della lega)
    score: {
      type: Number,
      required: true,
    },
    // La squadra giocava in casa in questo turno di campionato?
    // true = in casa → -2pt fattore campo applicati al confronto TvT
    isHome: {
      type: Boolean,
      default: null,   // null = dato non disponibile (vecchi record)
    },
    // Gol virtuali calcolati dalla lega (se disponibile dallo scraping diretto)
    virtualGoals: {
      type: Number,
      default: null,
    },
    // Fonte del punteggio: 'scraping' o 'manual'
    source: {
      type: String,
      enum: ['scraping', 'manual'],
      default: 'scraping',
    },
    // Data e ora dello scraping
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v
        return ret
      },
    },
  }
)

// Indice unico: un punteggio per squadra per giornata per stagione
matchdayScoreSchema.index({ teamId: 1, matchday: 1, season: 1 }, { unique: true })
matchdayScoreSchema.index({ matchday: 1, season: 1 })

module.exports = mongoose.model('MatchdayScore', matchdayScoreSchema)
