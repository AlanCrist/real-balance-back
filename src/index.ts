import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'

// Routes
import profileRoutes from './routes/profile.js'
import accountRoutes from './routes/accounts.js'
import transactionRoutes from './routes/transactions.js'
import creditCardRoutes from './routes/credit-cards.js'
import goalRoutes from './routes/goals.js'
import monthRoutes from './routes/months.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// All API routes require authentication
app.use('/api', authMiddleware)

// Mount routes
app.use('/api/profile', profileRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/credit-cards', creditCardRoutes)
app.use('/api/goals', goalRoutes)
app.use('/api/months', monthRoutes)

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   Real Balance API                   ║
  ║   http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝
  `)
})
