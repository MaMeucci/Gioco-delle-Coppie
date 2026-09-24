import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  Tab,
  Tabs,
  Alert,
  Skeleton,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { COLORS, RESULT_LABELS, RESULT_COLORS, TvT_RULES } from '../utils/constants'

// Card per una singola squadra con i suoi 9 scontri
function TeamMatchdayCard({ result, color }) {
  if (!result) return null

  const { teamName, fantaScore, adjustedScore, homeAdjustment, virtualGoals, wins, draws, losses, tvtPoints, matchups } = result
  const isHome = homeAdjustment < 0

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: `${color}44`,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Header squadra */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {teamName}
              </Typography>
              {isHome && (
                <Tooltip title="Gioca in casa: −2pt fattore campo">
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>🏠</Typography>
                </Tooltip>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {isHome ? (
                <>
                  FP: <s style={{ opacity: 0.5 }}>{fantaScore}</s>{' '}
                  <strong style={{ color: '#e65100' }}>{adjustedScore}</strong>
                  <span style={{ color: '#e65100' }}> (−2)</span>
                  {' · '}
                </>
              ) : (
                <>FP: <strong>{fantaScore}</strong> · </>
              )}
              GoV: <strong>{virtualGoals}</strong>
            </Typography>
          </Box>
          <Chip
            label={`${tvtPoints}pt`}
            size="small"
            sx={{
              bgcolor: color,
              color: 'white',
              fontWeight: 800,
              fontSize: '0.85rem',
              minWidth: 44,
            }}
          />
        </Stack>

        {/* Contatori V/N/S */}
        <Stack direction="row" spacing={0.5} mb={1.5} justifyContent="center">
          {[
            { label: wins, color: COLORS.win, title: 'Vittorie' },
            { label: draws, color: COLORS.draw, title: 'Pareggi' },
            { label: losses, color: COLORS.loss, title: 'Sconfitte' },
          ].map(({ label, color: c, title }, i) => (
            <Tooltip key={i} title={title}>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  bgcolor: `${c}18`,
                  borderRadius: 1,
                  py: 0.3,
                }}
              >
                <Typography variant="caption" fontWeight={700} color={c}>
                  {['V', 'N', 'S'][i]}: {label}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Stack>

        {/* Scontri singoli */}
        {matchups && matchups.length > 0 && (
          <>
            <Divider sx={{ mb: 1 }} />
            <Stack spacing={0.4}>
              {matchups.map((m, i) => (
                <Stack
                  key={i}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    px: 0.5,
                    py: 0.2,
                    borderRadius: 0.5,
                    bgcolor: `${RESULT_COLORS[m.result]}10`,
                  }}
                >
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ maxWidth: '65%', color: 'text.secondary' }}
                  >
                    {m.opponentName}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title={m.opponentAdjustedScore != null && m.opponentAdjustedScore !== m.opponentScore ? `FP grezzo: ${m.opponentScore}` : ''}>
                      <Typography variant="caption" color="text.secondary">
                        {m.opponentAdjustedScore != null ? m.opponentAdjustedScore : m.opponentScore}
                      </Typography>
                    </Tooltip>
                    <Chip
                      label={RESULT_LABELS[m.result]}
                      size="small"
                      sx={{
                        bgcolor: RESULT_COLORS[m.result],
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.6rem',
                        height: 18,
                        minWidth: 22,
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{ color: RESULT_COLORS[m.result], minWidth: 14, textAlign: 'right' }}
                    >
                      +{m.points}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SerieMatchdayView({ results, isLoading, serie }) {
  const color = serie === 'A' ? COLORS.serieA : COLORS.serieB

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[...Array(10)].map((_, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    )
  }

  if (!results?.length) {
    return (
      <Alert severity="info">
        Nessun dato per questa giornata in Serie {serie}.
      </Alert>
    )
  }

  // Ordina per punti TvT decrescenti
  const sorted = [...results].sort((a, b) => b.tvtPoints - a.tvtPoints)

  return (
    <Grid container spacing={2}>
      {sorted.map((result) => (
        <Grid item xs={12} sm={6} md={4} key={result._id || result.teamId}>
          <TeamMatchdayCard result={result} color={color} />
        </Grid>
      ))}
    </Grid>
  )
}

function MatchdayPage() {
  const { matchday: matchdayParam } = useParams()
  const navigate = useNavigate()
  const matchday = parseInt(matchdayParam, 10) || 1
  const [activeSerie, setActiveSerie] = useState('A')

  const { data, isLoading, error } = useQuery({
    queryKey: ['matchday', matchday],
    queryFn: async () => {
      const res = await api.get(`/matchday/${matchday}`)
      return res.data.data
    },
    enabled: !isNaN(matchday),
  })

  const serieData = activeSerie === 'A' ? data?.serieA : data?.serieB

  // Statistiche sommario
  const getSummary = (results) => {
    if (!results?.length) return null
    const leader = [...results].sort((a, b) => b.tvtPoints - a.tvtPoints)[0]
    const totalGoals = results.reduce((s, r) => s + (r.virtualGoals || 0), 0)
    const avgFP = results.reduce((s, r) => s + (r.fantaScore || 0), 0) / results.length
    return { leader, avgFP: avgFP.toFixed(1), totalGoals }
  }

  const summary = getSummary(serieData)

  return (
    <Box>
      {/* Header navigazione giornata */}
      <Card sx={{ mb: 3, bgcolor: '#1a237e', color: 'white' }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <IconButton
              onClick={() => navigate(`/giornata/${matchday - 1}`)}
              disabled={matchday <= 1}
              sx={{ color: 'white', '&:disabled': { color: 'rgba(255,255,255,0.3)' } }}
            >
              <NavigateBeforeIcon />
            </IconButton>

            <Box textAlign="center">
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                <CalendarTodayIcon />
                <Typography variant="h5" fontWeight={800}>
                  Giornata {matchday}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {data?.season || '—'} · Max {TvT_RULES.MAX_POINTS_PER_MATCHDAY}pt per squadra
              </Typography>
            </Box>

            <IconButton
              onClick={() => navigate(`/giornata/${matchday + 1}`)}
              disabled={matchday >= 38}
              sx={{ color: 'white', '&:disabled': { color: 'rgba(255,255,255,0.3)' } }}
            >
              <NavigateNextIcon />
            </IconButton>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs Serie */}
      <Tabs
        value={activeSerie}
        onChange={(_, val) => setActiveSerie(val)}
        sx={{
          mb: 2,
          '& .MuiTabs-indicator': { bgcolor: activeSerie === 'A' ? COLORS.serieA : COLORS.serieB },
        }}
      >
        <Tab
          label={`Serie A (${data?.serieA?.length || 0})`}
          value="A"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: COLORS.serieA } }}
        />
        <Tab
          label={`Serie B (${data?.serieB?.length || 0})`}
          value="B"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: COLORS.serieB } }}
        />
      </Tabs>

      {/* Sommario giornata */}
      {summary && !isLoading && (
        <Card sx={{ mb: 2, bgcolor: '#f8f9fa' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={4} textAlign="center">
                <Typography variant="caption" color="text.secondary">Leader</Typography>
                <Typography variant="body2" fontWeight={700} noWrap>{summary.leader.teamName}</Typography>
                <Chip
                  label={`${summary.leader.tvtPoints}pt`}
                  size="small"
                  sx={{ bgcolor: activeSerie === 'A' ? COLORS.serieA : COLORS.serieB, color: 'white', fontWeight: 700 }}
                />
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Typography variant="caption" color="text.secondary">Media FP</Typography>
                <Typography variant="body1" fontWeight={700}>{summary.avgFP}</Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Typography variant="caption" color="text.secondary">Scontri simulati</Typography>
                <Typography variant="body1" fontWeight={700}>
                  {serieData ? serieData.length * (serieData.length - 1) / 2 : 0}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Errore */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      )}

      {/* Grid squadre */}
      <SerieMatchdayView
        results={serieData}
        isLoading={isLoading}
        serie={activeSerie}
      />
    </Box>
  )
}

export default MatchdayPage
