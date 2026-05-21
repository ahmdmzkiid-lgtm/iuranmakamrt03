import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { PrismaClient } from '@prisma/client'
import { sendPushNotification, sendPushToMultipleUsers, VAPID_PUBLIC_KEY } from '../services/pushNotification.js'

const router = Router()
const prisma = new PrismaClient()

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

// Get VAPID public key for frontend
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY })
})

// Subscribe to push notifications
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { endpoint, keys } = req.body
    const userId = req.user.id

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription data' })
    }

    // Upsert subscription (update if exists, create if not)
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    })

    res.json({ message: 'Berhasil berlangganan notifikasi' })
  } catch (error) {
    console.error('Error subscribing to push:', error)
    res.status(500).json({ error: 'Gagal berlangganan notifikasi' })
  }
})

// Unsubscribe from push notifications
router.post('/unsubscribe', verifyToken, async (req, res) => {
  try {
    const { endpoint } = req.body

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, userId: req.user.id }
      })
    } else {
      // Delete all subscriptions for this user
      await prisma.pushSubscription.deleteMany({
        where: { userId: req.user.id }
      })
    }

    res.json({ message: 'Berhasil berhenti berlangganan notifikasi' })
  } catch (error) {
    console.error('Error unsubscribing:', error)
    res.status(500).json({ error: 'Gagal berhenti berlangganan' })
  }
})

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

// Admin: Kirim pengingat tagihan ke warga tertentu
router.post('/send-reminder', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { wargaIds, message, bulan, tahun } = req.body

    if (!wargaIds || !Array.isArray(wargaIds) || wargaIds.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu warga' })
    }

    const currentMonth = bulan || new Date().getMonth() + 1
    const currentYear = tahun || new Date().getFullYear()

    // Get warga data with user info
    const wargaList = await prisma.warga.findMany({
      where: { id: { in: wargaIds } },
      include: { user: true }
    })

    const title = '📢 Pengingat Tagihan Iuran'
    const defaultMessage = `Pengingat: Tagihan iuran bulan ${getBulanName(currentMonth)} ${currentYear} belum dibayar. Mohon segera melakukan pembayaran.`
    const finalMessage = message || defaultMessage

    const notifications = wargaList.map(warga => ({
      userId: warga.userId,
      title,
      message: finalMessage
    }))

    await prisma.notification.createMany({ data: notifications })

    // Send push notifications
    const userIds = wargaList.map(w => w.userId)
    const pushResult = await sendPushToMultipleUsers(userIds, title, finalMessage, '/warga/tagihan')

    res.json({ 
      message: `Pengingat berhasil dikirim ke ${notifications.length} warga`,
      count: notifications.length,
      pushSent: pushResult.sent
    })
  } catch (error) {
    console.error('Error sending reminder:', error)
    res.status(500).json({ error: 'Gagal mengirim pengingat' })
  }
})

// Admin: Kirim pengingat ke semua warga yang belum bayar bulan ini
router.post('/send-reminder-unpaid', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { message, bulan, tahun } = req.body
    const currentMonth = bulan || new Date().getMonth() + 1
    const currentYear = tahun || new Date().getFullYear()

    // Get all warga
    const allWarga = await prisma.warga.findMany({
      include: { user: true, iuran: true }
    })

    // Filter warga yang belum bayar (iuran warga atau makam belum lunas)
    const unpaidWarga = allWarga.filter(w => {
      const iuranWarga = w.iuran.find(i => i.tipe === 'warga' && i.bulan === currentMonth && i.tahun === currentYear)
      const iuranMakam = w.iuran.find(i => i.tipe === 'makam' && i.bulan === currentMonth && i.tahun === currentYear)
      const wargaLunas = iuranWarga?.status === 'lunas'
      const makamLunas = iuranMakam?.status === 'lunas'
      return !wargaLunas || !makamLunas
    })

    if (unpaidWarga.length === 0) {
      return res.json({ message: 'Semua warga sudah membayar iuran bulan ini', count: 0 })
    }

    const title = '📢 Pengingat Tagihan Iuran'
    const defaultMessage = `Pengingat: Tagihan iuran bulan ${getBulanName(currentMonth)} ${currentYear} belum dibayar. Mohon segera melakukan pembayaran.`
    const finalMessage = message || defaultMessage

    const notifications = unpaidWarga.map(w => ({
      userId: w.userId,
      title,
      message: finalMessage
    }))

    await prisma.notification.createMany({ data: notifications })

    // Send push notifications
    const userIds = unpaidWarga.map(w => w.userId)
    const pushResult = await sendPushToMultipleUsers(userIds, title, finalMessage, '/warga/tagihan')

    res.json({ 
      message: `Pengingat berhasil dikirim ke ${notifications.length} warga yang belum bayar`,
      count: notifications.length,
      pushSent: pushResult.sent
    })
  } catch (error) {
    console.error('Error sending reminder to unpaid:', error)
    res.status(500).json({ error: 'Gagal mengirim pengingat' })
  }
})

// Admin: Kirim notifikasi custom ke warga
router.post('/send-custom', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { wargaIds, title, message, sendToAll } = req.body

    if (!title || !message) {
      return res.status(400).json({ error: 'Judul dan pesan wajib diisi' })
    }

    let targetWarga = []

    if (sendToAll) {
      targetWarga = await prisma.warga.findMany({ include: { user: true } })
    } else {
      if (!wargaIds || !Array.isArray(wargaIds) || wargaIds.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal satu warga atau centang kirim ke semua' })
      }
      targetWarga = await prisma.warga.findMany({
        where: { id: { in: wargaIds } },
        include: { user: true }
      })
    }

    const notifications = targetWarga.map(w => ({
      userId: w.userId,
      title: title,
      message: message
    }))

    await prisma.notification.createMany({ data: notifications })

    // Send push notifications
    const userIds = targetWarga.map(w => w.userId)
    const pushResult = await sendPushToMultipleUsers(userIds, title, message, '/warga')

    res.json({ 
      message: `Notifikasi berhasil dikirim ke ${notifications.length} warga`,
      count: notifications.length,
      pushSent: pushResult.sent
    })
  } catch (error) {
    console.error('Error sending custom notification:', error)
    res.status(500).json({ error: 'Gagal mengirim notifikasi' })
  }
})

export default router
