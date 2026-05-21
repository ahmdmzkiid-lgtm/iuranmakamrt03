import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import authRoutes from './routes/auth.js'
import wargaRoutes from './routes/warga.js'
import makamRoutes from './routes/makam.js'
import iuranRoutes from './routes/iuran.js'
import laporanRoutes from './routes/laporan.js'
import settingsRoutes from './routes/settings.js'
import notificationsRoutes from './routes/notifications.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const prisma = new PrismaClient()

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or postman)
    if (!origin) return callback(null, true)
    
    // Check if origin is explicitly in allowed list or is a Vercel deployment
    const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || 
                      origin.endsWith('.vercel.app');
                      
    if (isAllowed) {
      return callback(null, true)
    }
    
    return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/auth', authRoutes)
app.use('/warga', wargaRoutes)
app.use('/makam', makamRoutes)
app.use('/iuran', iuranRoutes)
app.use('/laporan', laporanRoutes)
app.use('/settings', settingsRoutes)
app.use('/notifications', notificationsRoutes)

app.get('/', (_req, res) => {
  res.status(200).send("OK")
})

app.get('/ping', (req, res) => {
  res.status(200).send('pong')
})

const initDB = async () => {
  try {
    const adminExists = await prisma.user.findFirst({
      where: { role: 'admin' }
    })
    
    if (!adminExists) {
      await prisma.user.create({
        data: {
          email: 'admin',
          nama: 'Admin RT 04',
          password: bcrypt.hashSync('admin123', 10),
          role: 'admin'
        }
      })
      console.log('Default admin account created: admin / admin123')
    }
  } catch (error) {
    console.error('Failed to init DB', error)
  }
}

app.listen(PORT, async () => {
  await initDB()
  console.log(`Server running on port ${PORT}`)
})
