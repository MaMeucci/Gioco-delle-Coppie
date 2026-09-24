# Tutti vs Tutti — Legazzate 2.0

App web full-stack che simula una competizione **"Tutti vs Tutti"** per la lega di fantacalcio **Legazzate 2.0** su [leghe.fantacalcio.it](https://leghe.fantacalcio.it).

## Come funziona

Ogni giornata, ogni squadra viene virtualmente confrontata con **tutte le altre** della propria serie (A o B). Per ogni confronto diretto si calcola:

- **Vittoria** → 3 punti TvT
- **Pareggio** → 1 punto TvT
- **Sconfitta** → 0 punti TvT

Il punteggio massimo teorico per giornata è **27 punti** (9 vittorie × 3pt).

Il confronto usa il **sistema gol virtuali** configurato nelle impostazioni Scontri Diretti della lega: il punteggio fantacalcio viene convertito in gol virtuali secondo `puntiPerGol` e `punteggiBase`, letti automaticamente tramite scraping.

**Struttura della lega:**
- Serie A: 10 squadre → 9 scontri simulati per squadra/giornata
- Serie B: 10 squadre → 9 scontri simulati per squadra/giornata

---

## Tech Stack

| Layer     | Tecnologia                                     |
|-----------|------------------------------------------------|
| Backend   | Node.js · Express · Mongoose · Playwright      |
| Database  | MongoDB Atlas                                  |
| Frontend  | React 19 · Vite · MUI v9 · React Query v5     |
| Scraping  | Playwright (SPA Angular autenticata)           |
| Deploy    | Railway (backend) · Vercel (frontend)          |

---

## Setup Backend

```bash
cd backend
npm install

# Copia e configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue credenziali reali

# Avvia in modalità sviluppo (nodemon)
npm run dev
```

Il backend si avvia su `http://localhost:3001`.

### Variabili d'ambiente backend (`.env`)

| Variabile        | Descrizione                                         |
|------------------|-----------------------------------------------------|
| `PORT`           | Porta del server Express (default: 3001)            |
| `MONGODB_URI`    | URI di connessione MongoDB Atlas                    |
| `CORS_ORIGIN`    | URL del frontend (es. `http://localhost:5173`)      |
| `FC_USERNAME`    | Username leghe.fantacalcio.it                       |
| `FC_PASSWORD`    | Password leghe.fantacalcio.it                       |
| `FC_LEGA_SLUG`   | Slug della lega (es. `lega-liz-zar`)                |
| `FC_SEASON`      | Stagione corrente (es. `2025-26`)                   |
| `ADMIN_SECRET`   | Segreto per proteggere le route admin               |
| `JWT_SECRET`     | Chiave JWT                                          |

---

## Setup Frontend

```bash
cd frontend
npm install

# Copia e configura le variabili d'ambiente
cp .env.example .env
# Modifica VITE_API_URL con l'URL del backend

# Avvia in modalità sviluppo
npm run dev
```

Il frontend si avvia su `http://localhost:5173`.

### Variabili d'ambiente frontend (`.env`)

| Variabile         | Descrizione                                         |
|-------------------|-----------------------------------------------------|
| `VITE_API_URL`    | URL base del backend (es. `http://localhost:3001/api`) |
| `VITE_ADMIN_MODE` | `true` per mostrare i pulsanti di aggiornamento dati |

---

## API Endpoints

| Metodo | Endpoint                        | Descrizione                                        |
|--------|---------------------------------|----------------------------------------------------|
| GET    | `/api/health`                   | Health check                                       |
| GET    | `/api/status`                   | Stato ultimo scraping e giornata più recente       |
| GET    | `/api/teams`                    | Lista squadre raggruppate per serie                |
| GET    | `/api/standings/:serie`         | Classifica TvT (`serie` = `A` o `B`)              |
| GET    | `/api/matchday/:matchday`       | Risultati TvT di una giornata (entrambe le serie)  |
| GET    | `/api/matchday/:matchday/:serie`| Risultati TvT di una giornata per serie            |
| POST   | `/api/scrape/init`              | 🔒 Scraping iniziale: squadre + impostazioni lega  |
| POST   | `/api/scrape/:matchday`         | 🔒 Scraping + calcolo TvT per una giornata         |
| POST   | `/api/scrape/all`               | 🔒 Scraping di tutte le giornate disponibili       |

> 🔒 Route protette: richiedono header `x-admin-secret: <ADMIN_SECRET>`

### Come aggiornare i dati

**Prima volta (inizializzazione):**
```bash
curl -X POST http://localhost:3001/api/scrape/init \
  -H "x-admin-secret: <ADMIN_SECRET>"
```

**Aggiornare una giornata specifica:**
```bash
curl -X POST http://localhost:3001/api/scrape/5 \
  -H "x-admin-secret: <ADMIN_SECRET>"
```

**Aggiornare tutte le giornate:**
```bash
curl -X POST http://localhost:3001/api/scrape/all \
  -H "x-admin-secret: <ADMIN_SECRET>"
```

---

## Deployment

### Backend → Railway

1. Fai push del repo su GitHub
2. Importa il progetto su [Railway](https://railway.app)
3. Imposta le variabili d'ambiente nel pannello Railway (stesse del `.env`)
4. Railway esegue `npm start` automaticamente (`node src/server.js`)

### Database → MongoDB Atlas

1. Crea un cluster M0 gratuito su [MongoDB Atlas](https://cloud.mongodb.com)
2. Aggiungi l'IP di Railway alla whitelist (o usa `0.0.0.0/0` per sviluppo)
3. Copia la connection string in `MONGODB_URI`

### Frontend → Vercel

1. Importa il repo su [Vercel](https://vercel.com)
2. Imposta la directory root su `frontend/`
3. Configura `VITE_API_URL` con l'URL del backend Railway
4. Vercel esegue `npm run build` e serve la cartella `dist/`

---

## Struttura del progetto

```
tutti-vs-tutti/
├── backend/
│   ├── src/
│   │   ├── config/        # Configurazioni (DB, scraper)
│   │   ├── controllers/   # Handler delle route
│   │   ├── jobs/          # Cron jobs (aggiornamento automatico)
│   │   ├── middleware/    # Auth, error handling
│   │   ├── models/        # Schemi Mongoose
│   │   ├── routes/        # Definizione route Express
│   │   ├── scripts/       # Script utilitari (seed, test scraping)
│   │   └── services/      # Business logic (scraping, calcolo TvT)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/    # Componenti React riutilizzabili
    │   ├── context/       # React Context (tema, admin mode)
    │   ├── pages/         # Pagine (Home, Standings, Matchday)
    │   ├── services/      # Client API axios
    │   └── utils/         # Costanti, helper
    ├── public/
    ├── index.html
    ├── vite.config.js
    ├── .env.example
    └── package.json
```
