const mongoose = require('mongoose')

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Il nome della squadra è obbligatorio'],
      trim: true,
    },
    serie: {
      type: String,
      enum: ['A', 'B'],
      required: [true, 'La serie è obbligatoria'],
    },
    // ID interno di leghe.fantacalcio.it — usato per matching durante lo scraping
    leagueTeamId: {
      type: String,
      required: false,
      trim: true,
    },
    // Nome dell'allenatore/proprietario della squadra su leghe.fantacalcio.it
    ownerName: {
      type: String,
      trim: true,
      default: null,
    },
    season: {
      type: String,
      required: true,
      default: () => {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        // La stagione calcistica inizia a luglio
        return month >= 7 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`
      },
    },
    active: {
      type: Boolean,
      default: true,
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

// Indice composto: una squadra per nome e serie per stagione
teamSchema.index({ name: 1, serie: 1, season: 1 }, { unique: true })
teamSchema.index({ leagueTeamId: 1, season: 1 })
teamSchema.index({ serie: 1, season: 1 })

module.exports = mongoose.model('Team', teamSchema)
