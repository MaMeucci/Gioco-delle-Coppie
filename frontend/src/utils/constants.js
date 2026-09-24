// Costanti dell'applicazione Tutti vs Tutti

export const SERIE = {
  A: 'A',
  B: 'B',
}

export const TvT_RULES = {
  WIN_POINTS: 3,
  DRAW_POINTS: 1,
  LOSS_POINTS: 0,
  OPPONENTS_PER_MATCHDAY: 9,
  MAX_POINTS_PER_MATCHDAY: 27, // 9 vittorie × 3pt
}

export const API_ENDPOINTS = {
  standings: '/standings',
  standingsBySerie: (serie) => `/standings/${serie}`,
  matchday: (matchday) => `/matchday/${matchday}`,
  matchdayBySerie: (matchday, serie) => `/matchday/${matchday}/${serie}`,
  teams: '/teams',
  status: '/status',
  // Admin (protetti da x-admin-secret)
  scrapeInit: '/scrape/init',
  scrapeMatchday: (matchday) => `/scrape/${matchday}`,
  scrapeAll: '/scrape/all',
  recalculate: '/scrape/recalculate',
}

// Tema colori (verde calcio + giallo)
export const COLORS = {
  primary: '#2E7D32',       // Verde scuro Serie A
  primaryLight: '#43A047',  // Verde chiaro
  secondary: '#F9A825',     // Giallo
  serieA: '#1565C0',        // Blu per Serie A
  serieB: '#E53935',        // Rosso per Serie B
  win: '#2E7D32',           // Verde vittoria
  draw: '#F57C00',          // Arancione pareggio
  loss: '#C62828',          // Rosso sconfitta
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
}

export const RESULT_LABELS = {
  W: 'V',
  D: 'N',
  L: 'S',
}

export const RESULT_COLORS = {
  W: COLORS.win,
  D: COLORS.draw,
  L: COLORS.loss,
}
