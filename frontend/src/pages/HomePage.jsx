import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  Divider,
  Stack,
  Button,
  Skeleton,
} from '@mui/material'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { COLORS, TvT_RULES } from '../utils/constants'

function HomePage() {
  const navigate = useNavigate()

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const res = await api.get('/status')
      return res.data.data
    },
    refetchInterval: 5 * 60 * 1000, // ogni 5 minuti
  })

  return (
    <Box>
      {/* Hero */}
      <Card
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
          color: 'white',
        }}
      >
        <CardContent sx={{ py: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} mb={1}>
            <SportsSoccerIcon sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Tutti vs Tutti
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                Legazzate 2.0 — Competizione Simulata
              </Typography>
            </Box>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>
            Ogni giornata, ogni squadra affronta virtualmente tutte le avversarie della propria serie.
            Punteggio massimo: <strong>{TvT_RULES.MAX_POINTS_PER_MATCHDAY} punti</strong> ({TvT_RULES.OPPONENTS_PER_MATCHDAY} vittorie × {TvT_RULES.WIN_POINTS}pt)
          </Typography>
        </CardContent>
      </Card>

      {/* Stato sistema */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <InfoOutlinedIcon color="primary" />
            <Typography variant="h6">Stato Lega</Typography>
          </Stack>

          {statusLoading ? (
            <Stack spacing={1}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Stack>
          ) : statusData ? (
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Stagione</Typography>
                <Typography variant="body1" fontWeight={600}>{statusData.season}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Ultima Giornata</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {statusData.lastCalculatedMatchday > 0
                    ? `${statusData.lastCalculatedMatchday}ª`
                    : 'Nessuna'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Punteggio Base</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {statusData.settings?.punteggiBase ?? '—'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Pt per Gol</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {statusData.settings?.puntiPerGol ?? '—'}
                </Typography>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="warning">
              Lega non inizializzata. Contatta l&apos;amministratore per avviare il primo scraping.
            </Alert>
          )}

          {statusData?.lastCalculatedMatchday > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CalendarTodayIcon />}
              onClick={() => navigate(`/giornata/${statusData.lastCalculatedMatchday}`)}
              sx={{ mt: 2 }}
            >
              Vai alla giornata {statusData.lastCalculatedMatchday}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Classifiche */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              cursor: 'pointer',
              border: `2px solid ${COLORS.serieA}`,
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
            }}
            onClick={() => navigate('/classifica/A')}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Chip
                    label="SERIE A"
                    size="small"
                    sx={{ bgcolor: COLORS.serieA, color: 'white', fontWeight: 700, mb: 1 }}
                  />
                  <Typography variant="h6" fontWeight={700}>Classifica Serie A</Typography>
                  <Typography variant="body2" color="text.secondary">
                    10 squadre · 9 scontri per giornata
                  </Typography>
                </Box>
                <LeaderboardIcon sx={{ fontSize: 40, color: COLORS.serieA, opacity: 0.6 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              cursor: 'pointer',
              border: `2px solid ${COLORS.serieB}`,
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
            }}
            onClick={() => navigate('/classifica/B')}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Chip
                    label="SERIE B"
                    size="small"
                    sx={{ bgcolor: COLORS.serieB, color: 'white', fontWeight: 700, mb: 1 }}
                  />
                  <Typography variant="h6" fontWeight={700}>Classifica Serie B</Typography>
                  <Typography variant="body2" color="text.secondary">
                    10 squadre · 9 scontri per giornata
                  </Typography>
                </Box>
                <LeaderboardIcon sx={{ fontSize: 40, color: COLORS.serieB, opacity: 0.6 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Regole TvT */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            📋 Come Funziona
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {[
              {
                icon: '⚽',
                title: 'Gol Virtuali',
                desc: 'Il punteggio fantacalcio viene convertito in gol virtuali secondo le regole della lega (soglia base + punti per gol).',
              },
              {
                icon: '🏆',
                title: 'Confronto Diretto',
                desc: 'Ogni squadra affronta virtualmente tutte le 9 avversarie della propria serie usando la stessa formazione della giornata.',
              },
              {
                icon: '📊',
                title: 'Punteggio',
                desc: `Vittoria: ${TvT_RULES.WIN_POINTS}pt | Pareggio: ${TvT_RULES.DRAW_POINTS}pt | Sconfitta: ${TvT_RULES.LOSS_POINTS}pt. Max ${TvT_RULES.MAX_POINTS_PER_MATCHDAY}pt per giornata.`,
              },
              {
                icon: '📅',
                title: 'Aggiornamento',
                desc: 'La classifica si aggiorna automaticamente dopo ogni giornata calcolata su leghe.fantacalcio.it.',
              },
            ].map((rule) => (
              <Grid item xs={12} sm={6} key={rule.title}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Typography fontSize={24}>{rule.icon}</Typography>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>{rule.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{rule.desc}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}

export default HomePage
