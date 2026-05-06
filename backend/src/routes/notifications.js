import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// Ambil notifikasi milik user
router.get('/', verifyToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    res.json(notifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ error: 'Gagal mengambil notifikasi' })
  }
})

// Tandai sudah dibaca
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { isRead: true }
    })
    res.json({ message: 'Notifikasi ditandai sudah dibaca' })
  } catch (error) {
    res.status(500).json({ error: 'Gagal update notifikasi' })
  }
})

// Tandai semua sudah dibaca
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    })
    res.json({ message: 'Semua notifikasi ditandai sudah dibaca' })
  } catch (error) {
    res.status(500).json({ error: 'Gagal update notifikasi' })
  }
})

export default router
