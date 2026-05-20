import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyCron } from '../middleware/cron.js'

const router = Router()
const prisma = new PrismaClient()

const handleCleanup = async (req, res) => {
  try {
    // 1. Delete all Iuran records
    const dIuran = await prisma.iuran.deleteMany()

    // 2. Delete all Warga records
    const dWarga = await prisma.warga.deleteMany()

    // 3. Delete all Notification records
    const dNotification = await prisma.notification.deleteMany()

    // 4. Delete all User records with role 'warga'
    const dUser = await prisma.user.deleteMany({
      where: {
        role: 'warga'
      }
    })

    // 5. Delete all Makam records
    const dMakam = await prisma.makam.deleteMany()

    console.log('Cron Job Cleanup Successful!')
    console.log({
      iuran: dIuran.count,
      warga: dWarga.count,
      notifications: dNotification.count,
      wargaUsers: dUser.count,
      makam: dMakam.count
    })

    res.json({
      message: 'Database cleanup executed successfully',
      deleted: {
        iuran: dIuran.count,
        warga: dWarga.count,
        notifications: dNotification.count,
        wargaUsers: dUser.count,
        makam: dMakam.count
      }
    })
  } catch (error) {
    console.error('Error during database cleanup via cron:', error)
    res.status(500).json({ message: 'Internal Server Error', error: error.message })
  }
}

// Support both GET and POST for cron-job.org
router.get('/execute-cron', verifyCron, handleCleanup)
router.post('/execute-cron', verifyCron, handleCleanup)

export default router
