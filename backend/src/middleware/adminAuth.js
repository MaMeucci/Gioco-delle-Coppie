/**
 * adminAuth.js — middleware per proteggere le route admin
 * Controlla l'header x-admin-secret contro la variabile ADMIN_SECRET
 */
const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret']

  if (!process.env.ADMIN_SECRET) {
    console.error('[Auth] ADMIN_SECRET non configurato nelle variabili d\'ambiente!')
    return res.status(500).json({ success: false, message: 'Server non configurato correttamente' })
  }

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({
      success: false,
      message: 'Accesso non autorizzato. Header x-admin-secret mancante o non valido.',
    })
  }

  next()
}

module.exports = adminAuth
