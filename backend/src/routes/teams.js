const { Router } = require('express')
const { getAllTeams } = require('../controllers/teamsController')

const router = Router()

// GET /api/teams
router.get('/', getAllTeams)

module.exports = router
