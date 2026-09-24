import React from 'react'
import { Box, Container } from '@mui/material'
import Navbar from './Navbar'

function Layout({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 3, flex: 1 }}>
        {children}
      </Container>
      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'text.secondary',
          bgcolor: 'white',
          borderTop: '1px solid #e0e0e0',
        }}
      >
        Tutti vs Tutti — Legazzate 2.0 | Powered by leghe.fantacalcio.it
      </Box>
    </Box>
  )
}

export default Layout
