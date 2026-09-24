import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Tab,
  Tabs,
  Alert,
  Skeleton,
  Avatar,
  Tooltip,
} from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { COLORS } from '../utils/constants'

const MEDAL_COLORS = {
  1: { bg: COLORS.gold, label: '🥇' },
  2: { bg: COLORS.silver, label: '🥈' },
  3: { bg: COLORS.bronze, label: '🥉' },
}

function StandingsTable({ standings, isLoading, serie }) {
  const color = serie === 'A' ? COLORS.serieA : COLORS.serieB

  if (isLoading) {
    return (
      <Stack spacing={1} sx={{ mt: 2 }}>
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1 }} />
        ))}
      </Stack>
    )
  }

  if (!standings?.length) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Nessun dato disponibile. La stagione non è ancora iniziata o i dati non sono stati caricati.
      </Alert>
    )
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 2, borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: color }}>
            {['#', 'Squadra', 'PG', 'V', 'N', 'S', 'Pt TvT', 'Media FP', 'GoV tot'].map((col) => (
              <TableCell
                key={col}
                align={col === 'Squadra' ? 'left' : 'center'}
                sx={{ color: 'white', fontWeight: 700, py: 1 }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {standings.map((team, idx) => {
            const pos = team.position || idx + 1
            const medal = MEDAL_COLORS[pos]
            return (
              <TableRow
                key={team.teamId}
                sx={{
                  bgcolor: pos === 1 ? 'rgba(255, 215, 0, 0.06)' : 'inherit',
                  '&:hover': { bgcolor: `${color}08` },
                }}
              >
                {/* Posizione */}
                <TableCell align="center" sx={{ width: 48, py: 1 }}>
                  {medal ? (
                    <Tooltip title={`${pos}° posto`}>
                      <span style={{ fontSize: 20 }}>{medal.label}</span>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                      {pos}
                    </Typography>
                  )}
                </TableCell>

                {/* Squadra */}
                <TableCell sx={{ py: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: 12,
                        bgcolor: color,
                        fontWeight: 700,
                      }}
                    >
                      {team.teamName?.[0]?.toUpperCase() || '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {team.teamName}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>

                {/* Giornate giocate */}
                <TableCell align="center">
                  <Typography variant="body2">{team.matchdaysPlayed}</Typography>
                </TableCell>

                {/* Vittorie */}
                <TableCell align="center">
                  <Typography variant="body2" color={COLORS.win} fontWeight={600}>
                    {team.totalWins}
                  </Typography>
                </TableCell>

                {/* Pareggi */}
                <TableCell align="center">
                  <Typography variant="body2" color={COLORS.draw} fontWeight={600}>
                    {team.totalDraws}
                  </Typography>
                </TableCell>

                {/* Sconfitte */}
                <TableCell align="center">
                  <Typography variant="body2" color={COLORS.loss} fontWeight={600}>
                    {team.totalLosses}
                  </Typography>
                </TableCell>

                {/* Punti TvT */}
                <TableCell align="center">
                  <Chip
                    label={team.totalTvtPoints}
                    size="small"
                    sx={{
                      bgcolor: color,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}
                  />
                </TableCell>

                {/* Media fantapunteggio */}
                <TableCell align="center">
                  <Typography variant="body2">{(team.avgAdjustedScore ?? team.avgFantaScore)?.toFixed(1)}</Typography>
                </TableCell>

                {/* Gol virtuali totali */}
                <TableCell align="center">
                  <Typography variant="body2">{team.totalVirtualGoals}</Typography>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function StandingsPage() {
  const { serie: serieParam } = useParams()
  const navigate = useNavigate()
  const serie = (serieParam || 'A').toUpperCase()
  const color = serie === 'A' ? COLORS.serieA : COLORS.serieB

  const { data, isLoading, error } = useQuery({
    queryKey: ['standings', serie],
    queryFn: async () => {
      const res = await api.get(`/standings/${serie}`)
      return res.data.data
    },
  })

  return (
    <Box>
      {/* Header */}
      <Card
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
          color: 'white',
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <EmojiEventsIcon sx={{ fontSize: 36 }} />
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Classifica Tutti vs Tutti
              </Typography>
              <Chip
                label={`SERIE ${serie}`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, mt: 0.5 }}
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs Serie A / B */}
      <Tabs
        value={serie}
        onChange={(_, val) => navigate(`/classifica/${val}`)}
        sx={{ mb: 2, '& .MuiTabs-indicator': { bgcolor: color } }}
      >
        <Tab
          label="Serie A"
          value="A"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: COLORS.serieA } }}
        />
        <Tab
          label="Serie B"
          value="B"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: COLORS.serieB } }}
        />
      </Tabs>

      {/* Classifica */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <LeaderboardIcon sx={{ color }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Stagione {data?.season || '—'} · {data?.standings?.length || 0} squadre
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Aggiornata automaticamente dopo ogni giornata
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}

          <StandingsTable standings={data?.standings} isLoading={isLoading} serie={serie} />
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            <strong>Legenda:</strong>{' '}
            PG = Giornate Giocate · V = Vittorie · N = Pareggi · S = Sconfitte ·
            Pt TvT = Punti Tutti vs Tutti · Media FP = Fantapunteggio medio · GoV = Gol Virtuali totali
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            <strong>Criteri di parità:</strong> 1) Punti TvT · 2) Vittorie · 3) Gol Virtuali totali · 4) Media FP
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

export default StandingsPage
