const mongoose = require('mongoose')

// Impostazioni della lega lette da leghe.fantacalcio.it
// Contiene le regole per la conversione punteggio → gol virtuali
const leagueSettingsSchema = new mongoose.Schema(
  {
    season: {
      type: String,
      required: true,
    },
    legaSlug: {
      type: String,
      required: true,
    },
    // Punteggio base (es. 60): a questo punteggio corrispondono 0 gol virtuali
    punteggiBase: {
      type: Number,
      required: true,
      default: 60,
    },
    // Punti per ogni gol virtuale (es. 6): ogni 6 punti sopra la base = 1 gol
    puntiPerGol: {
      type: Number,
      required: true,
      default: 6,
    },
    // Numero di squadre per serie (10 = 9 scontri per squadra)
    teamsPerSerie: {
      type: Number,
      default: 10,
    },
    // Totale giornate della stagione
    totalMatchdays: {
      type: Number,
      default: 38,
    },
    // Giornate interne della competizione già calcolate (calculated=true nel calendario)
    lastAvailableMatchday: {
      type: Number,
      default: 0,
    },
    // Prima giornata di Serie A in cui inizia questa competizione (sDay)
    competitionStartDay: {
      type: Number,
      default: 1,
    },
    // Data/ora della prossima giornata di Serie A da giocare
    nextMatchdayDate: {
      type: Date,
      default: null,
    },
    // Data ultimo aggiornamento delle impostazioni
    lastScrapedAt: {
      type: Date,
      default: Date.now,
    },
    // Dati raw opzionali per debug
    rawSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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

// Una sola configurazione attiva per stagione/lega
leagueSettingsSchema.index({ season: 1, legaSlug: 1 }, { unique: true })

module.exports = mongoose.model('LeagueSettings', leagueSettingsSchema)
