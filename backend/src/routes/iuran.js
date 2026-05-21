import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { storage } from '../utils/cloudinary.js'

const router = Router()
const prisma = new PrismaClient()

const upload = multer({ storage: storage })

const TARIF_WARGA = 10000  // Rp 10.000 per KK per bulan
const TARIF_MAKAM = 10000  // Rp 10.000 per orang per bulan
const TARGET_BULAN_MAKAM = 36

// ==================== GET ENDPOINTS ====================

// Ambil semua Iuran (Warga: miliknya, Admin: semua)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { tipe } = req.query // filter by tipe: 'warga' | 'makam' | undefined (all)
    
    const whereClause = {}
    if (tipe) whereClause.tipe = tipe
    
    if (req.user.role === 'warga') {
      const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
      if (!warga) return res.status(404).json({ message: 'Warga not found' })
      whereClause.wargaId = warga.id
    }

    const iuran = await prisma.iuran.findMany({
      where: whereClause,
      include: { warga: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return res.json(iuran)
  } catch (error) {
    console.error('Error GET iuran:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get summary/progress untuk warga
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const warga = await prisma.warga.findUnique({ 
      where: { userId: req.user.id },
      include: { user: true }
    })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Iuran warga bulan ini
    const iuranWargaBulanIni = await prisma.iuran.findFirst({
      where: {
        wargaId: warga.id,
        tipe: 'warga',
        bulan: currentMonth,
        tahun: currentYear,
        status: 'lunas'
      }
    })

    // Total iuran makam yang sudah lunas
    const totalMakamLunas = await prisma.iuran.aggregate({
      where: {
        wargaId: warga.id,
        tipe: 'makam',
        status: 'lunas'
      },
      _sum: { jumlahBulan: true }
    })

    // Pending payments
    const pendingPayments = await prisma.iuran.findMany({
      where: {
        wargaId: warga.id,
        status: 'pending'
      }
    })

    const bulanMakamTerbayar = totalMakamLunas._sum.jumlahBulan || warga.bulanMakamTerbayar || 0
    const sisaBulanMakam = Math.max(0, TARGET_BULAN_MAKAM - bulanMakamTerbayar)

    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length

    res.json({
      warga: {
        id: warga.id,
        nama: warga.user.nama,
        jumlahOrang: realJumlahOrang,
        bulanMakamTerbayar,
        sisaBulanMakam,
        targetBulanMakam: TARGET_BULAN_MAKAM,
        makamLunas: bulanMakamTerbayar >= TARGET_BULAN_MAKAM
      },
      iuranWarga: {
        bulanIni: currentMonth,
        tahunIni: currentYear,
        sudahBayar: !!iuranWargaBulanIni,
        tarif: TARIF_WARGA
      },
      iuranMakam: {
        tarifPerOrang: TARIF_MAKAM,
        totalTarifPerBulan: TARIF_MAKAM * realJumlahOrang
      },
      pendingPayments
    })
  } catch (error) {
    console.error('Error GET summary:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin: Get all warga dengan progress
router.get('/progress', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const allWarga = await prisma.warga.findMany({
      include: { 
        user: true,
        iuran: true
      }
    })

    const result = allWarga.map(w => {
      const famList = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga : []
      const realJumlahOrang = 1 + famList.length

      // Hitung bulan makam terbayar dari iuran lunas
      const makamLunas = w.iuran
        .filter(i => i.tipe === 'makam' && i.status === 'lunas')
        .reduce((sum, i) => sum + (i.jumlahBulan || 0), 0)
      
      const bulanMakamTerbayar = makamLunas || w.bulanMakamTerbayar || 0

      // Cek iuran warga bulan ini
      const wargaBulanIni = w.iuran.find(i => 
        i.tipe === 'warga' && 
        i.bulan === currentMonth && 
        i.tahun === currentYear &&
        i.status === 'lunas'
      )

      // Pending
      const pending = w.iuran.filter(i => i.status === 'pending')

      return {
        id: w.id,
        userId: w.userId,
        nama: w.user.nama,
        nomorKK: w.user.nomorKK,
        jumlahOrang: realJumlahOrang, // Hitung dinamis dari database KK + anggota
        bulanMakamTerbayar,
        sisaBulanMakam: Math.max(0, TARGET_BULAN_MAKAM - bulanMakamTerbayar),
        makamLunas: bulanMakamTerbayar >= TARGET_BULAN_MAKAM,
        wargaBulanIniLunas: !!wargaBulanIni,
        pendingCount: pending.length
      }
    })

    res.json(result)
  } catch (error) {
    console.error('Error GET progress:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ==================== WARGA BAYAR ENDPOINTS ====================

// Warga bayar iuran warga (bulanan)
router.post('/bayar-warga', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { metode, bulan, tahun } = req.body
    const buktiBayar = req.file ? req.file.path : null

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const bln = parseInt(bulan) || new Date().getMonth() + 1
    const thn = parseInt(tahun) || new Date().getFullYear()

    // Cek apakah sudah ada pembayaran untuk bulan ini
    const existing = await prisma.iuran.findFirst({
      where: {
        wargaId: warga.id,
        tipe: 'warga',
        bulan: bln,
        tahun: thn,
        status: { in: ['pending', 'lunas'] }
      }
    })

    if (existing) {
      return res.status(400).json({ message: `Iuran warga bulan ${bln}/${thn} sudah dibayar atau sedang diproses` })
    }

    await prisma.iuran.create({
      data: {
        wargaId: warga.id,
        tipe: 'warga',
        bulan: bln,
        tahun: thn,
        jumlah: TARIF_WARGA,
        status: 'pending',
        metode: metode || 'Transfer',
        buktiBayar,
        tanggalBayar: new Date()
      }
    })

    res.json({ message: 'Pembayaran iuran warga berhasil dikirim dan menunggu verifikasi.' })
  } catch (error) {
    console.error('Error bayar-warga:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Warga bayar iuran makam (cicilan)
router.post('/bayar-makam', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { metode, jumlahBulan } = req.body
    const buktiBayar = req.file ? req.file.path : null

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jBulan = parseInt(jumlahBulan) || 1
    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length
    
    // Hitung sisa bulan yang harus dibayar
    const totalMakamLunas = await prisma.iuran.aggregate({
      where: { wargaId: warga.id, tipe: 'makam', status: 'lunas' },
      _sum: { jumlahBulan: true }
    })
    const bulanTerbayar = totalMakamLunas._sum.jumlahBulan || warga.bulanMakamTerbayar || 0
    const sisaBulan = TARGET_BULAN_MAKAM - bulanTerbayar

    if (sisaBulan <= 0) {
      return res.status(400).json({ message: 'Iuran makam sudah lunas 36 bulan' })
    }

    if (jBulan > sisaBulan) {
      return res.status(400).json({ message: `Maksimal pembayaran ${sisaBulan} bulan lagi` })
    }

    const totalBayar = jBulan * realJumlahOrang * TARIF_MAKAM

    await prisma.iuran.create({
      data: {
        wargaId: warga.id,
        tipe: 'makam',
        jumlahBulan: jBulan,
        jumlahOrang: realJumlahOrang,
        jumlah: totalBayar,
        status: 'pending',
        metode: metode || 'Transfer',
        buktiBayar,
        tanggalBayar: new Date()
      }
    })

    res.json({ 
      message: `Pembayaran iuran makam ${jBulan} bulan berhasil dikirim dan menunggu verifikasi.`,
      detail: {
        jumlahBulan: jBulan,
        jumlahOrang: realJumlahOrang,
        totalBayar
      }
    })
  } catch (error) {
    console.error('Error bayar-makam:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Warga bayar keduanya sekaligus
router.post('/bayar-semua', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { metode, jumlahBulanMakam, bulanWarga, tahunWarga } = req.body
    const buktiBayar = req.file ? req.file.path : null

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jBulanMakam = parseInt(jumlahBulanMakam) || 1
    const bln = parseInt(bulanWarga) || new Date().getMonth() + 1
    const thn = parseInt(tahunWarga) || new Date().getFullYear()
    const transaksiId = `TRX-${Date.now()}`

    // Validasi makam
    const totalMakamLunas = await prisma.iuran.aggregate({
      where: { wargaId: warga.id, tipe: 'makam', status: 'lunas' },
      _sum: { jumlahBulan: true }
    })
    const bulanTerbayar = totalMakamLunas._sum.jumlahBulan || warga.bulanMakamTerbayar || 0
    const sisaBulan = TARGET_BULAN_MAKAM - bulanTerbayar

    if (jBulanMakam > sisaBulan) {
      return res.status(400).json({ message: `Maksimal pembayaran makam ${sisaBulan} bulan lagi` })
    }

    // Cek iuran warga bulan ini
    const existingWarga = await prisma.iuran.findFirst({
      where: {
        wargaId: warga.id,
        tipe: 'warga',
        bulan: bln,
        tahun: thn,
        status: { in: ['pending', 'lunas'] }
      }
    })

    if (existingWarga) {
      return res.status(400).json({ message: `Iuran warga bulan ${bln}/${thn} sudah dibayar atau sedang diproses` })
    }

    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length

    const totalMakam = jBulanMakam * realJumlahOrang * TARIF_MAKAM
    const totalWarga = TARIF_WARGA
    const grandTotal = totalMakam + totalWarga

    // Create both iuran records
    await prisma.iuran.createMany({
      data: [
        {
          wargaId: warga.id,
          tipe: 'warga',
          bulan: bln,
          tahun: thn,
          jumlah: totalWarga,
          status: 'pending',
          metode: metode || 'Transfer',
          buktiBayar,
          tanggalBayar: new Date(),
          transaksiId
        },
        {
          wargaId: warga.id,
          tipe: 'makam',
          jumlahBulan: jBulanMakam,
          jumlahOrang: realJumlahOrang,
          jumlah: totalMakam,
          status: 'pending',
          metode: metode || 'Transfer',
          buktiBayar,
          tanggalBayar: new Date(),
          transaksiId
        }
      ]
    })

    res.json({ 
      message: 'Pembayaran berhasil dikirim dan menunggu verifikasi.',
      detail: {
        iuranWarga: totalWarga,
        iuranMakam: totalMakam,
        grandTotal
      }
    })
  } catch (error) {
    console.error('Error bayar-semua:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ==================== ADMIN VERIFIKASI ENDPOINTS ====================

// Admin verifikasi pembayaran
router.put('/:id/verifikasi', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const id = parseInt(req.params.id)
    const { action, alasan } = req.body // 'terima' atau 'tolak'
    
    const iuran = await prisma.iuran.findUnique({ 
      where: { id },
      include: { warga: { include: { user: true } } }
    })
    if (!iuran) return res.status(404).json({ message: 'Not found' })

    if (action === 'tolak') {
      await prisma.iuran.update({
        where: { id },
        data: { 
          status: 'ditolak', 
          catatanAdmin: alasan || 'Pembayaran ditolak oleh admin'
        },
      })
      
      await prisma.notification.create({
        data: {
          userId: iuran.warga.userId,
          title: 'Pembayaran Ditolak',
          message: `Maaf, pembayaran ${iuran.tipe === 'warga' ? 'iuran warga' : 'iuran makam'} Anda ditolak. Alasan: ${alasan || 'Tidak ada alasan spesifik'}. Silakan bayar kembali.`
        }
      })

      return res.json({ message: 'Pembayaran ditolak' })
    }

    // Terima pembayaran
    await prisma.iuran.update({
      where: { id },
      data: { 
        status: 'lunas',
        catatanAdmin: 'Pembayaran diverifikasi'
      },
    })

    // Update progress makam jika tipe makam
    if (iuran.tipe === 'makam' && iuran.jumlahBulan) {
      await prisma.warga.update({
        where: { id: iuran.wargaId },
        data: { bulanMakamTerbayar: { increment: iuran.jumlahBulan } }
      })
    }

    await prisma.notification.create({
      data: {
        userId: iuran.warga.userId,
        title: 'Pembayaran Diterima',
        message: `Selamat! Pembayaran ${iuran.tipe === 'warga' ? 'iuran warga' : 'iuran makam'} Anda telah diverifikasi. Terima kasih!`
      }
    })
    
    res.json({ message: 'Pembayaran diverifikasi' })
  } catch (error) {
    console.error('Error PUT verifikasi:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin verifikasi transaksi (untuk bayar sekaligus)
router.put('/verifikasi-transaksi/:transaksiId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    
    const { transaksiId } = req.params
    const { action, alasan } = req.body
    
    const iurans = await prisma.iuran.findMany({ 
      where: { transaksiId },
      include: { warga: { include: { user: true } } }
    })
    
    if (iurans.length === 0) return res.status(404).json({ message: 'Transaksi not found' })

    const warga = iurans[0].warga

    if (action === 'tolak') {
      await prisma.iuran.updateMany({
        where: { transaksiId },
        data: { 
          status: 'ditolak', 
          catatanAdmin: alasan || 'Pembayaran ditolak oleh admin'
        },
      })
      
      await prisma.notification.create({
        data: {
          userId: warga.userId,
          title: 'Pembayaran Ditolak',
          message: `Maaf, pembayaran Anda ditolak. Alasan: ${alasan || 'Tidak ada alasan spesifik'}. Silakan bayar kembali.`
        }
      })

      return res.json({ message: 'Pembayaran ditolak' })
    }

    // Terima semua
    await prisma.iuran.updateMany({
      where: { transaksiId },
      data: { 
        status: 'lunas',
        catatanAdmin: 'Pembayaran diverifikasi'
      },
    })

    // Update progress makam
    const makamIuran = iurans.find(i => i.tipe === 'makam')
    if (makamIuran && makamIuran.jumlahBulan) {
      await prisma.warga.update({
        where: { id: makamIuran.wargaId },
        data: { bulanMakamTerbayar: { increment: makamIuran.jumlahBulan } }
      })
    }

    await prisma.notification.create({
      data: {
        userId: warga.userId,
        title: 'Pembayaran Diterima',
        message: 'Selamat! Pembayaran Anda telah diverifikasi. Terima kasih!'
      }
    })
    
    res.json({ message: 'Semua pembayaran dalam transaksi diverifikasi' })
  } catch (error) {
    console.error('Error verifikasi-transaksi:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ==================== ADMIN INPUT OFFLINE ====================

// Admin input pembayaran offline iuran warga
router.post('/admin/bayar-warga', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { wargaId, bulan, tahun } = req.body
    const wId = parseInt(wargaId)
    const bln = parseInt(bulan) || new Date().getMonth() + 1
    const thn = parseInt(tahun) || new Date().getFullYear()

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    // Cek duplikat
    const existing = await prisma.iuran.findFirst({
      where: { wargaId: wId, tipe: 'warga', bulan: bln, tahun: thn, status: 'lunas' }
    })
    if (existing) {
      return res.status(400).json({ message: `Iuran warga bulan ${bln}/${thn} sudah lunas` })
    }

    await prisma.iuran.create({
      data: {
        wargaId: wId,
        tipe: 'warga',
        bulan: bln,
        tahun: thn,
        jumlah: TARIF_WARGA,
        status: 'lunas',
        metode: 'Tunai (Offline)',
        tanggalBayar: new Date()
      }
    })

    res.json({ message: `Pembayaran iuran warga bulan ${bln}/${thn} berhasil dicatat` })
  } catch (error) {
    console.error('Error admin bayar-warga:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin input pembayaran offline iuran makam
router.post('/admin/bayar-makam', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { wargaId, jumlahBulan } = req.body
    const wId = parseInt(wargaId)
    const jBulan = parseInt(jumlahBulan) || 1

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    // Validasi sisa bulan
    const sisaBulan = TARGET_BULAN_MAKAM - (warga.bulanMakamTerbayar || 0)
    if (jBulan > sisaBulan) {
      return res.status(400).json({ message: `Maksimal pembayaran ${sisaBulan} bulan lagi` })
    }

    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length

    const totalBayar = jBulan * realJumlahOrang * TARIF_MAKAM

    await prisma.iuran.create({
      data: {
        wargaId: wId,
        tipe: 'makam',
        jumlahBulan: jBulan,
        jumlahOrang: realJumlahOrang,
        jumlah: totalBayar,
        status: 'lunas',
        metode: 'Tunai (Offline)',
        tanggalBayar: new Date()
      }
    })

    await prisma.warga.update({
      where: { id: wId },
      data: { bulanMakamTerbayar: { increment: jBulan } }
    })

    res.json({ 
      message: `Pembayaran iuran makam ${jBulan} bulan berhasil dicatat`,
      detail: { jumlahBulan: jBulan, totalBayar }
    })
  } catch (error) {
    console.error('Error admin bayar-makam:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin input pembayaran offline keduanya
router.post('/admin/bayar-semua', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { wargaId, jumlahBulanMakam, bulanWarga, tahunWarga } = req.body
    const wId = parseInt(wargaId)
    const jBulanMakam = parseInt(jumlahBulanMakam) || 1
    const bln = parseInt(bulanWarga) || new Date().getMonth() + 1
    const thn = parseInt(tahunWarga) || new Date().getFullYear()
    const transaksiId = `OFF-${Date.now()}`

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    // Validasi
    const sisaBulan = TARGET_BULAN_MAKAM - (warga.bulanMakamTerbayar || 0)
    if (jBulanMakam > sisaBulan) {
      return res.status(400).json({ message: `Maksimal pembayaran makam ${sisaBulan} bulan lagi` })
    }

    const existingWarga = await prisma.iuran.findFirst({
      where: { wargaId: wId, tipe: 'warga', bulan: bln, tahun: thn, status: 'lunas' }
    })
    if (existingWarga) {
      return res.status(400).json({ message: `Iuran warga bulan ${bln}/${thn} sudah lunas` })
    }

    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length

    const totalMakam = jBulanMakam * realJumlahOrang * TARIF_MAKAM
    const totalWarga = TARIF_WARGA

    await prisma.iuran.createMany({
      data: [
        {
          wargaId: wId,
          tipe: 'warga',
          bulan: bln,
          tahun: thn,
          jumlah: totalWarga,
          status: 'lunas',
          metode: 'Tunai (Offline)',
          tanggalBayar: new Date(),
          transaksiId
        },
        {
          wargaId: wId,
          tipe: 'makam',
          jumlahBulan: jBulanMakam,
          jumlahOrang: realJumlahOrang,
          jumlah: totalMakam,
          status: 'lunas',
          metode: 'Tunai (Offline)',
          tanggalBayar: new Date(),
          transaksiId
        }
      ]
    })

    await prisma.warga.update({
      where: { id: wId },
      data: { bulanMakamTerbayar: { increment: jBulanMakam } }
    })

    res.json({ 
      message: 'Pembayaran berhasil dicatat',
      detail: { iuranWarga: totalWarga, iuranMakam: totalMakam, grandTotal: totalWarga + totalMakam }
    })
  } catch (error) {
    console.error('Error admin bayar-semua:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ==================== STATISTIK ====================

router.get('/statistik', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Total warga (semua orang, bukan hanya KK)
    const allWarga = await prisma.warga.findMany({
      select: { anggotaKeluarga: true }
    })
    const totalWarga = allWarga.reduce((sum, w) => {
      const famList = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga : []
      return sum + 1 + famList.length
    }, 0)

    const totalKK = allWarga.length

    // Iuran warga bulan ini
    const wargaLunasBulanIni = await prisma.iuran.count({
      where: { tipe: 'warga', bulan: currentMonth, tahun: currentYear, status: 'lunas' }
    })

    // Total pendapatan iuran warga bulan ini
    const pendapatanWargaBulanIni = await prisma.iuran.aggregate({
      where: { tipe: 'warga', bulan: currentMonth, tahun: currentYear, status: 'lunas' },
      _sum: { jumlah: true }
    })

    // Total pendapatan iuran makam
    const pendapatanMakam = await prisma.iuran.aggregate({
      where: { tipe: 'makam', status: 'lunas' },
      _sum: { jumlah: true }
    })

    // Warga yang sudah lunas makam 36 bulan
    const wargaMakamLunas = await prisma.warga.count({
      where: { bulanMakamTerbayar: { gte: TARGET_BULAN_MAKAM } }
    })

    // Pending verifikasi
    const pendingCount = await prisma.iuran.count({
      where: { status: 'pending' }
    })

    res.json({
      totalWarga, // Semua orang
      totalKK,    // Tambahkan info totalKK jika dibutuhkan
      iuranWarga: {
        bulanIni: currentMonth,
        tahunIni: currentYear,
        sudahBayar: wargaLunasBulanIni,
        belumBayar: Math.max(0, totalKK - wargaLunasBulanIni),
        pendapatan: pendapatanWargaBulanIni._sum.jumlah || 0
      },
      iuranMakam: {
        targetBulan: TARGET_BULAN_MAKAM,
        wargaLunas36Bulan: wargaMakamLunas,
        totalPendapatan: pendapatanMakam._sum.jumlah || 0
      },
      pendingVerifikasi: pendingCount
    })
  } catch (error) {
    console.error('Error GET statistik:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
