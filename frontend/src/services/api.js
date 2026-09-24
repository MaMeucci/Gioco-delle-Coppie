import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor — normalizza gli errori
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message =
      error.response?.data?.message ||
      (status === 404 ? 'Risorsa non trovata' :
        status === 401 ? 'Non autorizzato' :
          status === 500 ? 'Errore del server' :
            error.message || 'Errore di rete')

    const enhancedError = new Error(message)
    enhancedError.status = status
    enhancedError.originalError = error
    return Promise.reject(enhancedError)
  }
)

export default api
