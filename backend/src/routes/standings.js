const { Router } = require('express')
const { getStandings, getAllStandings } = require('../controllers/standingsController')

const router = Router()

// GET /api/standings — entrambe le serie
router.get('/', getAllStandings)

// GET /api/standings/A — classifica Serie A
// GET /api/standings/B — classifica Serie B
router.get('/:serie', getStandings)

module.exports = router
