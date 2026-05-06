import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'

const router = Router()
const prisma = new PrismaClient()

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, 'bukti-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })

// Ambil semua Iuran (Warga: miliknya, Admin: semua)
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'warga') {
      const iuran = await prisma.iuran.findMany({
        where: { warga: { userId: req.user.id } },
        include: { warga: { include: { user: true } } },
        orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
      })
      return res.json(iuran)
    } else {
      const iuran = await prisma.iuran.findMany({
        include: { warga: { include: { user: true } } },
        orderBy: [{ createdAt: 'desc' }],
      })
      return res.json(iuran)
    }
  } catch (error) {
    console.error('Error GET iuran:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Warga bayar (ubah status -> pending)
router.post('/bayar', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { iuranIds, metode } = req.body
    const buktiBayar = req.file ? `/uploads/${req.file.filename}` : null
    
    const ids = JSON.parse(iuranIds)

    if (!ids || ids.length === 0) {
      return res.status(400).json({ message: 'Pilih minimal 1 tagihan' })
    }

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    await prisma.iuran.updateMany({
      where: {
        id: { in: ids },
        wargaId: warga.id,
      },
      data: {
        status: 'pending',
        metode: metode || 'Transfer',
        buktiBayar: buktiBayar,
        tanggalBayar: new Date(),
      },
    })
    
    res.json({ message: 'Pembayaran berhasil dikirim dan menunggu verifikasi.' })
  } catch (error) {
    console.error('Error POST bayar:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin verifikasi pembayaran online
router.put('/:id/verifikasi', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const id = parseInt(req.params.id)
    const { action, alasan } = req.body // 'terima' atau 'tolak'
    
    const iuran = await prisma.iuran.findUnique({ 
      where: { id },
      include: { warga: true }
    })
    if (!iuran) return res.status(404).json({ message: 'Not found' })

    if (action === 'tolak') {
      await prisma.iuran.update({
        where: { id },
        data: { 
          status: 'belum_bayar', 
          metode: null, 
          tanggalBayar: null,
          catatanAdmin: alasan || 'Pembayaran ditolak oleh admin'
        },
      })
      
      // Kirim notifikasi penolakan
      await prisma.notification.create({
        data: {
          userId: iuran.warga.userId,
          title: 'Pembayaran Ditolak',
          message: `Maaf, pembayaran iuran Anda untuk periode ${iuran.bulan}/${iuran.tahun} ditolak. Alasan: ${alasan || 'Tidak ada alasan spesifik'}. Silakan bayar kembali.`
        }
      })

      return res.json({ message: 'Pembayaran ditolak' })
    }

    if (iuran.status !== 'lunas') {
      await prisma.iuran.update({
        where: { id },
        data: { 
          status: 'lunas',
          catatanAdmin: 'Pembayaran diverifikasi'
        },
      })
      await prisma.warga.update({
        where: { id: iuran.wargaId },
        data: { bulanTerbayar: { increment: 1 } }
      })

      // Kirim notifikasi sukses
      await prisma.notification.create({
        data: {
          userId: iuran.warga.userId,
          title: 'Pembayaran Diterima',
          message: `Selamat! Pembayaran iuran Anda untuk periode ${iuran.bulan}/${iuran.tahun} telah diverifikasi. Terima kasih!`
        }
      })
    }
    
    res.json({ message: 'Pembayaran diverifikasi' })
  } catch (error) {
    console.error('Error PUT verifikasi:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin bayar offline (langsung lunas)
router.put('/:id/offline', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const id = parseInt(req.params.id)
    
    const iuran = await prisma.iuran.findUnique({ where: { id } })
    if (!iuran) return res.status(404).json({ message: 'Not found' })

    if (iuran.status !== 'lunas') {
      await prisma.iuran.update({
        where: { id },
        data: {
          status: 'lunas',
          metode: 'Tunai (Offline)',
          tanggalBayar: new Date(),
        },
      })
      await prisma.warga.update({
        where: { id: iuran.wargaId },
        data: { bulanTerbayar: { increment: 1 } }
      })
    }
    
    res.json({ message: 'Pembayaran offline berhasil dicatat' })
  } catch (error) {
    console.error('Error PUT offline:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Warga bayar di awal (bayar bulan ke depan)
router.post('/bayar-awal', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { jumlahBulan, metode } = req.body
    const buktiBayar = req.file ? `/uploads/${req.file.filename}` : null

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jBulan = parseInt(jumlahBulan) || 1
    const jumlahTagihan = 10000 * (warga.jumlahMakam || 1)

    // Cari iuran terakhir untuk menentukan tahun & bulan selanjutnya
    const lastIuran = await prisma.iuran.findFirst({
      where: { wargaId: warga.id },
      orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }]
    })

    let startTahun = new Date().getFullYear()
    let startBulan = new Date().getMonth() + 1

    if (lastIuran) {
      startTahun = lastIuran.tahun
      startBulan = lastIuran.bulan + 1
      if (startBulan > 12) {
        startBulan = 1
        startTahun++
      }
    }

    const newIurans = []
    for (let i = 0; i < jBulan; i++) {
      let b = startBulan + i
      let t = startTahun
      while (b > 12) {
        b -= 12
        t++
      }
      newIurans.push({
        wargaId: warga.id,
        tahun: t,
        bulan: b,
        jumlah: jumlahTagihan,
        status: 'pending',
        metode: metode || 'Transfer',
        buktiBayar: buktiBayar,
        tanggalBayar: new Date(),
      })
    }

    await prisma.iuran.createMany({ data: newIurans })

    res.json({ message: `Berhasil mengajukan pembayaran ${jBulan} bulan di awal.` })
  } catch (error) {
    console.error('Error POST bayar-awal:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin generate iuran massal (untuk bulan berjalan)
router.post('/generate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const { tahun, bulan } = req.body // Misal: 2023, 11
    if (!tahun || !bulan) return res.status(400).json({ message: 'Tahun dan bulan diperlukan' })

    const semuaWarga = await prisma.warga.findMany()
    
    let created = 0
    for (const w of semuaWarga) {
      const exists = await prisma.iuran.findFirst({
        where: { wargaId: w.id, tahun, bulan }
      })
      if (!exists) {
        await prisma.iuran.create({
          data: {
            wargaId: w.id,
            tahun,
            bulan,
            jumlah: 10000 * (w.jumlahMakam || 1),
            status: 'belum_bayar',
          }
        })
        created++
      }
    }

    res.json({ message: `${created} tagihan berhasil di-generate` })
  } catch (error) {
    console.error('Error POST generate:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin bayar offline untuk bulan depan (langsung lunas)
router.post('/offline-advance', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const { wargaId, jumlahBulan } = req.body
    const wId = parseInt(wargaId)
    const jBulan = parseInt(jumlahBulan) || 1
    const tId = `OFF-${Date.now()}` // Transaksi ID untuk grouping

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jumlahTagihan = 10000 * (warga.jumlahMakam || 1)

    // 1. Ambil tagihan belum bayar yang sudah ada
    const existingBelumBayar = await prisma.iuran.findMany({
      where: { wargaId: wId, status: 'belum_bayar' },
      orderBy: [{ tahun: 'asc' }, { bulan: 'asc' }],
      take: jBulan
    })

    const updateIds = existingBelumBayar.map(i => i.id)
    let processedMonths = 0

    if (updateIds.length > 0) {
      await prisma.iuran.updateMany({
        where: { id: { in: updateIds } },
        data: {
          status: 'lunas',
          metode: 'Tunai (Offline)',
          tanggalBayar: new Date(),
          transaksiId: tId
        }
      })
      processedMonths += updateIds.length
    }

    // 2. Jika masih kurang, buat tagihan baru untuk bulan-bulan ke depan
    const remainingMonths = jBulan - processedMonths
    if (remainingMonths > 0) {
      const lastIuran = await prisma.iuran.findFirst({
        where: { wargaId: wId },
        orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }]
      })

      let startTahun = new Date().getFullYear()
      let startBulan = new Date().getMonth() + 1

      if (lastIuran) {
        startTahun = lastIuran.tahun
        startBulan = lastIuran.bulan + 1
        if (startBulan > 12) {
          startBulan = 1
          startTahun++
        }
      }

      const newIurans = []
      for (let i = 0; i < remainingMonths; i++) {
        let b = startBulan + i
        let t = startTahun
        while (b > 12) {
          b -= 12
          t++
        }
        newIurans.push({
          wargaId: wId,
          tahun: t,
          bulan: b,
          jumlah: jumlahTagihan,
          status: 'lunas',
          metode: 'Tunai (Offline)',
          tanggalBayar: new Date(),
          transaksiId: tId
        })
      }
      await prisma.iuran.createMany({ data: newIurans })
      processedMonths += remainingMonths
    }

    // 3. Update bulanTerbayar di model Warga
    await prisma.warga.update({
      where: { id: wId },
      data: { bulanTerbayar: { increment: processedMonths } }
    })

    res.json({ message: `Berhasil mencatat pembayaran offline untuk ${jBulan} bulan.` })
  } catch (error) {
    console.error('Error POST offline-advance:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Kirim pengingat ke warga yang belum bayar
router.post('/kirim-pengingat', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' })

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // 1. Ambil semua warga
    const allWarga = await prisma.warga.findMany({
      include: {
        iuran: {
          where: {
            bulan: currentMonth,
            tahun: currentYear
          }
        }
      }
    })

    // 2. Identifikasi warga yang belum punya record iuran bulan ini (baru daftar)
    const missingIuran = allWarga.filter(w => w.iuran.length === 0)
    
    if (missingIuran.length > 0) {
      const newIurans = missingIuran.map(w => ({
        wargaId: w.id,
        bulan: currentMonth,
        tahun: currentYear,
        jumlah: (w.jumlahMakam || 1) * 10000,
        status: 'belum_bayar'
      }))
      await prisma.iuran.createMany({ data: newIurans })
    }

    // 3. Ambil ulang semua yang statusnya 'belum_bayar' (termasuk yang baru dibuat)
    const belumBayar = await prisma.iuran.findMany({
      where: {
        bulan: currentMonth,
        tahun: currentYear,
        status: 'belum_bayar'
      },
      include: {
        warga: true
      }
    })

    if (belumBayar.length === 0) {
      return res.json({ message: 'Tidak ada warga yang perlu diingatkan bulan ini.' })
    }

    const notifications = belumBayar.map(item => ({
      userId: item.warga.userId,
      title: 'Tagihan Iuran Makam',
      message: `Halo! Mohon segera melakukan pembayaran iuran makam periode ${currentMonth}/${currentYear}. Terima kasih!`
    }))

    await prisma.notification.createMany({
      data: notifications
    })

    res.json({ message: `Berhasil mengirim ${notifications.length} pengingat (termasuk membuat ${missingIuran.length} tagihan baru).` })
  } catch (error) {
    console.error('Error kirim-pengingat:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
