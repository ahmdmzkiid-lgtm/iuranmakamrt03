import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyCron } from '../middleware/cron.js'

const router = Router()
const prisma = new PrismaClient()

const handleMonthlyGeneration = (req, res) => {
  // 1. Kirim respon HTTP 200 dengan payload teks minimalis secepatnya agar cronjob.org tidak timeout / terkena batas limit
  res.status(200).send("OK")

  // 2. Jalankan logika proses yang berat secara asynchronous di background
  const prosesBackground = async () => {
    const now = new Date()
    const tahun = now.getFullYear()
    const bulan = now.getMonth() + 1

    console.log(`[Cron] Starting automatic monthly iuran generation for ${bulan}/${tahun}...`)

    const semuaWarga = await prisma.warga.findMany()
    const IURAN_PER_UNIT = 10000
    let created = 0

    for (const w of semuaWarga) {
      for (const tipe of ['warga', 'makam']) {
        const exists = await prisma.iuran.findFirst({
          where: { wargaId: w.id, tipe, tahun, bulan }
        })

        if (!exists) {
          let nominal = IURAN_PER_UNIT // default untuk iuran warga (10rb/KK)
          if (tipe === 'makam') {
            // Iuran makam: 10rb x (1 kepala keluarga + jumlah anggota)
            const jumlahAnggota = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga.length : 0
            const totalOrang = 1 + jumlahAnggota
            nominal = IURAN_PER_UNIT * totalOrang
          }

          await prisma.iuran.create({
            data: {
              wargaId: w.id,
              tipe,
              tahun,
              bulan,
              jumlah: nominal,
              status: 'belum_bayar',
            }
          })
          created++
        }
      }
    }

    // Hemat Log: cetak log yang singkat dan padat dalam satu baris ke console server
    console.log(`[Cron] Generation Success! Created ${created} monthly iuran records for ${bulan}/${tahun}`)
  }

  // Jalankan background process tanpa await, tangani error agar tidak mengganggu respons / crash
  prosesBackground().catch((error) => {
    console.error('[Cron] Error during database automatic iuran generation in background:', error)
  })
}

// Support both GET and POST for cron-job.org
router.get('/execute-cron', verifyCron, handleMonthlyGeneration)
router.post('/execute-cron', verifyCron, handleMonthlyGeneration)

export default router
