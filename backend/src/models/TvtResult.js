const mongoose = require('mongoose')

// Dettaglio di un singolo scontro simulato tra due squadre
const matchupSchema = new mongoose.Schema(
  {
    opponentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    opponentName: {
      type: String,
      required: true,
    },
    // Punteggio fantacalcio grezzo dell'avversario
    opponentScore: {
      type: Number,
      required: true,
    },
    // Punteggio effettivo avversario dopo fattore campo
    opponentAdjustedScore: {
      type: Number,
      default: null,
    },
    // Gol virtuali dell'avversario (calcolati da adjustedScore)
    opponentVirtualGoals: {
      type: Number,
      default: null,
    },
    // Esito per questa squadra: W = vittoria, D = pareggio, L = sconfitta
    result: {
      type: String,
      enum: ['W', 'D', 'L'],
      required: true,
    },
    // Punti TvT ottenuti in questo singolo scontro (3, 1, o 0)
    points: {
      type: Number,
      enum: [0, 1, 3],
      required: true,
    },
  },
  { _id: false }
)

const tvtResultSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    teamName: {
      type: String,
      required: true,
    },
    serie: {
      type: String,
      enum: ['A', 'B'],
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
    // Punteggio fantacalcio originale della giornata (grezzo, prima del fattore campo)
    fantaScore: {
      type: Number,
      required: true,
    },
    // Aggiustamento fattore campo: -2 se giocava in casa, 0 altrimenti
    homeAdjustment: {
      type: Number,
      default: 0,
    },
    // Punteggio effettivo usato nei confronti TvT (fantaScore + homeAdjustment)
    adjustedScore: {
      type: Number,
      default: null,
    },
    // Gol virtuali calcolati (da adjustedScore con regole lega)
    virtualGoals: {
      type: Number,
      required: true,
      default: 0,
    },
    // Contatori scontri
    wins: {
      type: Number,
      default: 0,
      min: 0,
      max: 9,
    },
    draws: {
      type: Number,
      default: 0,
      min: 0,
      max: 9,
    },
    losses: {
      type: Number,
      default: 0,
      min: 0,
      max: 9,
    },
    // Punti TvT totali della giornata (max 27)
    tvtPoints: {
      type: Number,
      default: 0,
      min: 0,
      max: 27,
    },
    // Dettaglio di ogni scontro simulato (9 per squadra)
    matchups: {
      type: [matchupSchema],
      default: [],
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

// Virtual: numero di scontri giocati
tvtResultSchema.virtual('matchesPlayed').get(function () {
  return this.wins + this.draws + this.losses
})

// Indice unico: un risultato per squadra per giornata per stagione
tvtResultSchema.index({ teamId: 1, matchday: 1, season: 1 }, { unique: true })
tvtResultSchema.index({ serie: 1, matchday: 1, season: 1 })
tvtResultSchema.index({ season: 1, serie: 1 })

module.exports = mongoose.model('TvtResult', tvtResultSchema)
