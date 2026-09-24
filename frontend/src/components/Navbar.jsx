import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
} from '@mui/material'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import { COLORS } from '../utils/constants'

function Navbar() {
  const location = useLocation()

  const isActive = (path) =>
    location.pathname.startsWith(path) ? 'contained' : 'outlined'

  return (
    <AppBar
      position="static"
      sx={{
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {/* Logo */}
        <SportsSoccerIcon sx={{ mr: 1 }} />
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{
            flexGrow: 1,
            color: 'white',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: { xs: '0.95rem', sm: '1.1rem' },
          }}
        >
          Tutti vs Tutti
          <Chip
            label="Legazzate 2.0"
            size="small"
            sx={{
              ml: 1,
              bgcolor: COLORS.secondary,
              color: '#333',
              fontWeight: 700,
              fontSize: '0.65rem',
            }}
          />
        </Typography>

        {/* Nav links */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            component={Link}
            to="/classifica/A"
            variant={isActive('/classifica/A')}
            size="small"
            startIcon={<LeaderboardIcon />}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.6)',
              '&.MuiButton-contained': { bgcolor: 'rgba(255,255,255,0.2)' },
              '&.MuiButton-outlined': { borderColor: 'rgba(255,255,255,0.5)' },
            }}
          >
            Serie A
          </Button>
          <Button
            component={Link}
            to="/classifica/B"
            variant={isActive('/classifica/B')}
            size="small"
            startIcon={<LeaderboardIcon />}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.6)',
              '&.MuiButton-contained': { bgcolor: 'rgba(255,255,255,0.2)' },
              '&.MuiButton-outlined': { borderColor: 'rgba(255,255,255,0.5)' },
            }}
          >
            Serie B
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Navbar
