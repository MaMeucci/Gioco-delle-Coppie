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

const COLUMNS = [
  { id: 'pos', label: '#', align: 'center', width: 44 },
  { id: 'team', label: 'Squadra', align: 'left', minWidth: 160 },
  { id: 'pg', label: 'PG', align: 'center', width: 44 },
  { id: 'w', label: 'V', align: 'center', width: 40 },
  { id: 'd', label: 'N', align: 'center', width: 40 },
  { id: 'l', label: 'S', align: 'center', width: 40 },
  { id: 'pt', label: 'Pt TvT', align: 'center', width: 68 },
  { id: 'avg', label: 'Media FP', align: 'center', width: 72 },
  { id: 'gov', label: 'GoV tot', align: 'center', width: 64 },
]

function StandingsTable({ standings, isLoading, serie }) {
  const color = serie === 'A' ? COLORS.serieA : COLORS.serieB

  if (isLoading) {
    return (
      <Stack spacing={1} sx={{ mt: 2 }}>
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
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
    <TableContainer component={Paper} sx={{ mt: 1.5, borderRadius: 2, border: '1px solid #e8e8e8', boxShadow: 'none', overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: color }}>
            {COLUMNS.map((col) => (
              <TableCell
                key={col.id}
                align={col.align}
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  py: 0.75,
                  px: 1,
                  fontSize: '0.8rem',
                  width: col.width || 'auto',
                  minWidth: col.minWidth || 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
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
                <TableCell align="center" sx={{ width: 44, py: 0.5, px: 0.5 }}>
                  {medal ? (
                    <Tooltip title={`${pos}° posto`}>
                      <span style={{ fontSize: 18 }}>{medal.label}</span>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" fontWeight={600} color="text.secondary" fontSize="0.85rem">
                      {pos}
                    </Typography>
                  )}
                </TableCell>

                {/* Squadra */}
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        fontSize: 11,
                        bgcolor: color,
                        fontWeight: 700,
                      }}
                    >
                      {team.teamName?.[0]?.toUpperCase() || '?'}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600} fontSize="0.85rem" noWrap>
                      {team.teamName}
                    </Typography>
                  </Stack>
                </TableCell>

                {/* Giornate giocate */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Typography variant="body2" fontSize="0.85rem">{team.matchdaysPlayed}</Typography>
                </TableCell>

                {/* Vittorie */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Typography variant="body2" color={COLORS.win} fontWeight={600} fontSize="0.85rem">
                    {team.totalWins}
                  </Typography>
                </TableCell>

                {/* Pareggi */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Typography variant="body2" color={COLORS.draw} fontWeight={600} fontSize="0.85rem">
                    {team.totalDraws}
                  </Typography>
                </TableCell>

                {/* Sconfitte */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Typography variant="body2" color={COLORS.loss} fontWeight={600} fontSize="0.85rem">
                    {team.totalLosses}
                  </Typography>
                </TableCell>

                {/* Punti TvT */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Chip
                    label={team.totalTvtPoints}
                    size="small"
                    sx={{
                      bgcolor: color,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      height: 22,
                      minWidth: 32,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                </TableCell>

                {/* Media fantapunteggio */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Typography variant="body2" fontSize="0.85rem">{(team.avgAdjustedScore ?? team.avgFantaScore)?.toFixed(1)}</Typography>
                </TableCell>

                {/* Gol virtuali totali */}
                <TableCell align="center" sx={{ py: 0.5, px: 0.75 }}>
                  <Typography variant="body2" fontSize="0.85rem">{team.totalVirtualGoals}</Typography>
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
    <Box sx={{ maxWidth: 880, mx: 'auto' }}>
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
