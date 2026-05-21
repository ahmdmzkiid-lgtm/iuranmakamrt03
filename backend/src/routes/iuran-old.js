import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { storage } from '../utils/cloudinary.js'

const router = Router()
const prisma = new PrismaClient()

// Multer configuration using Cloudinary
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
        orderBy: [{ tanggalBayar: 'desc' }, { tahun: 'desc' }, { bulan: 'desc' }],
      })
      // Sort: lunas first, then pending, then belum_bayar
      const statusOrder = { 'lunas': 0, 'pending': 1, 'belum_bayar': 2 }
      const sorted = iuran.sort((a, b) => {
        return statusOrder[a.status] - statusOrder[b.status]
      })
      return res.json(sorted)
    }
  } catch (error) {
    console.error('Error GET iuran:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Warga bayar (ubah status -> pending)
router.post('/bayar', verifyToken, (req, res, next) => {
  upload.single('buktiBayar')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err)
      return res.status(500).json({ message: 'Gagal upload bukti: ' + err.message })
    }
    next()
  })
}, async (req, res) => {
  console.log('=== POST /bayar called ===')
  console.log('Body:', req.body)
  console.log('File:', req.file)
  console.log('User:', req.user)
  try {
    const { iuranIds, metode } = req.body
    const buktiBayar = req.file ? req.file.path : null
    
    let ids
    try {
      ids = typeof iuranIds === 'string' ? JSON.parse(iuranIds) : iuranIds
    } catch (e) {
      console.log('Parse error:', e)
      return res.status(400).json({ message: 'Format iuranIds tidak valid' })
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Pilih minimal 1 tagihan' })
    }

    // Convert string ids to integers
    const intIds = ids.map(id => parseInt(id))
    console.log('Bayar iuran ids:', intIds, 'metode:', metode)

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    await prisma.iuran.updateMany({
      where: {
        id: { in: intIds },
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
    console.error('Error POST bayar:', error.message, error.stack)
    res.status(500).json({ message: error.message || 'Internal server error' })
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
    const { jumlahBulan, metode, tipe, jumlah } = req.body
    const buktiBayar = req.file ? req.file.path : null
    const iuranTipe = tipe || 'makam'

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jBulan = parseInt(jumlahBulan) || 1
    const jumlahTagihan = parseInt(jumlah) || 0
    if (jumlahTagihan <= 0) return res.status(400).json({ message: 'Nominal iuran wajib diisi' })

    // Cari iuran terakhir untuk tipe ini
    const lastIuran = await prisma.iuran.findFirst({
      where: { wargaId: warga.id, tipe: iuranTipe },
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
        tipe: iuranTipe,
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

// Admin tambah iuran individual
router.post('/tambah', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { wargaId, tipe, tahun, bulan, jumlah } = req.body
    const wId = parseInt(wargaId)
    const bln = parseInt(bulan)
    const thn = parseInt(tahun)

    if (!wId || !tipe || !bln || !thn) {
      return res.status(400).json({ message: 'Warga, tipe, bulan, dan tahun wajib diisi' })
    }

    if (!['warga', 'makam'].includes(tipe)) {
      return res.status(400).json({ message: 'Tipe harus "warga" atau "makam"' })
    }

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga tidak ditemukan' })

    // Check duplicate
    const exists = await prisma.iuran.findFirst({
      where: { wargaId: wId, tipe, tahun: thn, bulan: bln }
    })
    if (exists) {
      return res.status(400).json({ message: `Tagihan ${tipe} untuk bulan ${bln}/${thn} sudah ada` })
    }

    if (!jumlah || parseInt(jumlah) <= 0) {
      return res.status(400).json({ message: 'Nominal iuran wajib diisi' })
    }

    const iuran = await prisma.iuran.create({
      data: {
        wargaId: wId,
        tipe,
        tahun: thn,
        bulan: bln,
        jumlah: parseInt(jumlah),
        status: 'belum_bayar'
      },
      include: { warga: { include: { user: true } } }
    })

    res.json({ message: `Tagihan ${tipe === 'warga' ? 'Iuran Bulanan' : 'Iuran Makam'} berhasil ditambah`, iuran })
  } catch (error) {
    console.error('Error POST tambah iuran:', error)
    res.status(500).json({ message: 'Gagal menambah tagihan' })
  }
})

// Admin generate iuran massal (untuk bulan berjalan)
// Iuran warga: 10.000/KK (tetap)
// Iuran makam: 10.000 x (1 kepala keluarga + jumlah anggota)
router.post('/generate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const { tahun, bulan, tipe } = req.body
    if (!tahun || !bulan || !tipe) return res.status(400).json({ message: 'Tahun, bulan, dan tipe diperlukan' })
    if (!['warga', 'makam'].includes(tipe)) return res.status(400).json({ message: 'Tipe harus "warga" atau "makam"' })

    const semuaWarga = await prisma.warga.findMany()
    const IURAN_PER_UNIT = 10000
    
    let created = 0
    for (const w of semuaWarga) {
      const exists = await prisma.iuran.findFirst({
        where: { wargaId: w.id, tahun, bulan, tipe }
      })
      if (!exists) {
        // Hitung nominal berdasarkan tipe
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
    
    const { wargaId, jumlahBulan, tipe, jumlah } = req.body
    const wId = parseInt(wargaId)
    const jBulan = parseInt(jumlahBulan) || 1
    const iuranTipe = tipe || 'makam'
    const tId = `OFF-${Date.now()}`

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jumlahTagihan = parseInt(jumlah) || 0
    if (jumlahTagihan <= 0) return res.status(400).json({ message: 'Nominal iuran wajib diisi' })

    // 1. Ambil tagihan belum bayar yang sudah ada untuk tipe ini
    const existingBelumBayar = await prisma.iuran.findMany({
      where: { wargaId: wId, status: 'belum_bayar', tipe: iuranTipe },
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
        where: { wargaId: wId, tipe: iuranTipe },
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
          tipe: iuranTipe,
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

    // 3. Update bulanTerbayar di model Warga (only for makam type)
    if (iuranTipe === 'makam') {
      await prisma.warga.update({
        where: { id: wId },
        data: { bulanTerbayar: { increment: processedMonths } }
      })
    }

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

    // Ambil semua yang statusnya 'belum_bayar'
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

    // Group by userId to avoid duplicate notifications
    const userNotifMap = {}
    belumBayar.forEach(item => {
      const uid = item.warga.userId
      if (!userNotifMap[uid]) userNotifMap[uid] = []
      userNotifMap[uid].push(item.tipe === 'warga' ? 'Iuran Warga' : 'Iuran Makam')
    })

    const notifications = Object.entries(userNotifMap).map(([userId, tipes]) => ({
      userId: parseInt(userId),
      title: 'Tagihan Iuran RT',
      message: `Halo! Mohon segera melakukan pembayaran ${tipes.join(' & ')} periode ${currentMonth}/${currentYear}. Terima kasih!`
    }))

    await prisma.notification.createMany({
      data: notifications
    })

    res.json({ message: `Berhasil mengirim ${notifications.length} pengingat.` })
  } catch (error) {
    console.error('Error kirim-pengingat:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
