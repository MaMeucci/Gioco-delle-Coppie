const { Router } = require('express')
const { getMatchdayResults, getMatchdayResultsBySerie } = require('../controllers/matchdayController')

const router = Router()

// GET /api/matchday/:matchday — risultati entrambe le serie
router.get('/:matchday', getMatchdayResults)

// GET /api/matchday/:matchday/:serie — risultati per una serie
router.get('/:matchday/:serie', getMatchdayResultsBySerie)

module.exports = router
