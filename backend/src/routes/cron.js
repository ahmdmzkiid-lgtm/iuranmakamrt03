import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyCron } from '../middleware/cron.js'

const router = Router()
const prisma = new PrismaClient()

const handleCleanup = (req, res) => {
  // 1. Kirim respon HTTP 200 dengan payload teks minimalis secepatnya agar cronjob.org tidak timeout / terkena batas limit
  res.status(200).send("OK")

  // 2. Jalankan logika proses yang berat secara asynchronous di background
  const prosesBackground = async () => {
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

    // Hemat Log: cetak log yang singkat dan padat dalam satu baris ke console server
    console.log(`[Cron] Cleanup Success! Deleted: iuran(${dIuran.count}), warga(${dWarga.count}), notifications(${dNotification.count}), wargaUsers(${dUser.count}), makam(${dMakam.count})`)
  }

  // Jalankan background process tanpa await, tangani error agar tidak mengganggu respons / crash
  prosesBackground().catch((error) => {
    console.error('[Cron] Error during database cleanup in background:', error)
  })
}

// Support both GET and POST for cron-job.org
router.get('/execute-cron', verifyCron, handleCleanup)
router.post('/execute-cron', verifyCron, handleCleanup)

export default router
