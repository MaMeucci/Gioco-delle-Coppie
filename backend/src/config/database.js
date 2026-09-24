const mongoose = require('mongoose')

let isConnected = false

const connectDB = async () => {
  if (isConnected) {
    console.log('[DB] Already connected')
    return
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI non configurata nelle variabili d\'ambiente')
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })

    isConnected = true
    console.log(`[DB] MongoDB connesso: ${conn.connection.host}`)

    // Event listeners
    mongoose.connection.on('error', (err) => {
      console.error('[DB] Errore connessione MongoDB:', err)
      isConnected = false
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnesso')
      isConnected = false
    })

    mongoose.connection.on('reconnected', () => {
      console.log('[DB] MongoDB riconnesso')
      isConnected = true
    })
  } catch (err) {
    console.error('[DB] Impossibile connettersi a MongoDB:', err.message)
    throw err
  }
}

const disconnectDB = async () => {
  if (!isConnected) return
  await mongoose.disconnect()
  isConnected = false
  console.log('[DB] MongoDB disconnesso')
}

module.exports = { connectDB, disconnectDB }
