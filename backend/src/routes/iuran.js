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
const TARGET_BULAN_MAKAM = 35

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

    // Info bulan-bulan warga (untuk multi-month payment)
    // Ambil 12 bulan ke depan mulai dari bulan sekarang
    const bulanWargaInfo = []
    for (let i = 0; i < 12; i++) {
      let m = currentMonth + i
      let y = currentYear
      if (m > 12) {
        m = m - 12
        y = y + 1
      }

      const iuranBulanIni = await prisma.iuran.findFirst({
        where: {
          wargaId: warga.id,
          tipe: 'warga',
          bulan: m,
          tahun: y
        }
      })

      const status = iuranBulanIni 
        ? (iuranBulanIni.status === 'lunas' ? 'lunas' : iuranBulanIni.status)
        : 'belum_bayar'

      bulanWargaInfo.push({
        bulan: m,
        tahun: y,
        status,
        iuranId: iuranBulanIni?.id || null
      })
    }

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
        tarif: TARIF_WARGA,
        bulanList: bulanWargaInfo
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

// Warga bayar iuran warga (bulanan) - Support multi-bulan
router.post('/bayar-warga', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { metode, startBulan, startTahun, jumlahBulanWarga } = req.body
    const buktiBayar = req.file ? req.file.path : null

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const startBln = parseInt(startBulan) || new Date().getMonth() + 1
    const startThn = parseInt(startTahun) || new Date().getFullYear()
    const jBulanWarga = Math.max(1, Math.min(12, parseInt(jumlahBulanWarga) || 1)) // Min 1, Max 12

    // Generate list bulan yang akan dibayar
    const bulanList = []
    let currentBln = startBln
    let currentThn = startThn

    for (let i = 0; i < jBulanWarga; i++) {
      bulanList.push({ bulan: currentBln, tahun: currentThn })
      currentBln++
      if (currentBln > 12) {
        currentBln = 1
        currentThn++
      }
    }

    // Validasi: Cek setiap bulan apakah sudah ada pembayaran
    const invalidBulan = []
    for (const { bulan, tahun } of bulanList) {
      const existing = await prisma.iuran.findFirst({
        where: {
          wargaId: warga.id,
          tipe: 'warga',
          bulan,
          tahun,
          status: { in: ['pending', 'lunas'] }
        }
      })
      if (existing) invalidBulan.push(`${bulan}/${tahun}`)
    }

    if (invalidBulan.length > 0) {
      return res.status(400).json({ 
        message: `Bulan berikut sudah dibayar atau sedang diproses: ${invalidBulan.join(', ')}` 
      })
    }

    // Create transaksi ID untuk grouping
    const transaksiId = `TRX-WARGA-${Date.now()}`
    const totalBayar = jBulanWarga * TARIF_WARGA

    // Create multiple records (satu per bulan)
    const iuranData = bulanList.map(({ bulan, tahun }) => ({
      wargaId: warga.id,
      tipe: 'warga',
      bulan,
      tahun,
      jumlah: TARIF_WARGA,
      status: 'pending',
      metode: metode || 'Transfer',
      buktiBayar,
      tanggalBayar: new Date(),
      transaksiId
    }))

    await prisma.iuran.createMany({ data: iuranData })

    res.json({ 
      message: `Pembayaran iuran warga ${jBulanWarga} bulan berhasil dikirim dan menunggu verifikasi.`,
      detail: {
        jumlahBulan: jBulanWarga,
        totalBayar,
        bulanList: bulanList.map(b => `${b.bulan}/${b.tahun}`),
        transaksiId
      }
    })
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
      return res.status(400).json({ message: 'Iuran makam sudah lunas 35 bulan' })
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

// Warga bayar keduanya sekaligus - Support multi-bulan warga
router.post('/bayar-semua', verifyToken, upload.single('buktiBayar'), async (req, res) => {
  try {
    const { metode, jumlahBulanMakam, startBulanWarga, startTahunWarga, jumlahBulanWarga } = req.body
    const buktiBayar = req.file ? req.file.path : null

    if (metode !== 'Bayar Tunai' && !buktiBayar) {
      return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah untuk transfer' })
    }

    const warga = await prisma.warga.findUnique({ where: { userId: req.user.id } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    const jBulanMakam = parseInt(jumlahBulanMakam) || 1
    const startBln = parseInt(startBulanWarga) || new Date().getMonth() + 1
    const startThn = parseInt(startTahunWarga) || new Date().getFullYear()
    const jBulanWarga = Math.max(1, Math.min(12, parseInt(jumlahBulanWarga) || 1))
    const transaksiId = `TRX-SEMUA-${Date.now()}`

    // Generate list bulan warga yang akan dibayar
    const bulanWargaList = []
    let currentBln = startBln
    let currentThn = startThn

    for (let i = 0; i < jBulanWarga; i++) {
      bulanWargaList.push({ bulan: currentBln, tahun: currentThn })
      currentBln++
      if (currentBln > 12) {
        currentBln = 1
        currentThn++
      }
    }

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

    // Validasi warga: Cek setiap bulan apakah sudah ada pembayaran
    const invalidBulan = []
    for (const { bulan, tahun } of bulanWargaList) {
      const existingWarga = await prisma.iuran.findFirst({
        where: {
          wargaId: warga.id,
          tipe: 'warga',
          bulan,
          tahun,
          status: { in: ['pending', 'lunas'] }
        }
      })
      if (existingWarga) invalidBulan.push(`${bulan}/${tahun}`)
    }

    if (invalidBulan.length > 0) {
      return res.status(400).json({ 
        message: `Bulan warga berikut sudah dibayar atau sedang diproses: ${invalidBulan.join(', ')}` 
      })
    }

    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length

    const totalMakam = jBulanMakam * realJumlahOrang * TARIF_MAKAM
    const totalWarga = jBulanWarga * TARIF_WARGA
    const grandTotal = totalMakam + totalWarga

    // Create iuran records untuk warga (multiple bulan)
    const wargaIuranData = bulanWargaList.map(({ bulan, tahun }) => ({
      wargaId: warga.id,
      tipe: 'warga',
      bulan,
      tahun,
      jumlah: TARIF_WARGA,
      status: 'pending',
      metode: metode || 'Transfer',
      buktiBayar,
      tanggalBayar: new Date(),
      transaksiId
    }))

    // Create iuran record untuk makam
    const makamIuran = {
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

    // Create semua records sekaligus
    const allData = [...wargaIuranData, makamIuran]
    await prisma.iuran.createMany({ data: allData })

    res.json({ 
      message: 'Pembayaran berhasil dikirim dan menunggu verifikasi.',
      detail: {
        warga: {
          jumlahBulan: jBulanWarga,
          total: totalWarga,
          bulanList: bulanWargaList.map(b => `${b.bulan}/${b.tahun}`)
        },
        makam: {
          jumlahBulan: jBulanMakam,
          jumlahOrang: realJumlahOrang,
          total: totalMakam
        },
        grandTotal,
        transaksiId
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

// Admin input pembayaran offline iuran warga - Support multi-bulan
router.post('/admin/bayar-warga', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { wargaId, startBulan, startTahun, jumlahBulanWarga } = req.body
    const wId = parseInt(wargaId)
    const startBln = parseInt(startBulan) || new Date().getMonth() + 1
    const startThn = parseInt(startTahun) || new Date().getFullYear()
    const jBulanWarga = Math.max(1, Math.min(12, parseInt(jumlahBulanWarga) || 1))

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    // Generate list bulan yang akan dibayar
    const bulanList = []
    let currentBln = startBln
    let currentThn = startThn

    for (let i = 0; i < jBulanWarga; i++) {
      bulanList.push({ bulan: currentBln, tahun: currentThn })
      currentBln++
      if (currentBln > 12) {
        currentBln = 1
        currentThn++
      }
    }

    // Validasi: Cek setiap bulan apakah sudah lunas
    const duplikat = []
    for (const { bulan, tahun } of bulanList) {
      const existing = await prisma.iuran.findFirst({
        where: { wargaId: wId, tipe: 'warga', bulan, tahun, status: 'lunas' }
      })
      if (existing) duplikat.push(`${bulan}/${tahun}`)
    }
    
    if (duplikat.length > 0) {
      return res.status(400).json({ 
        message: `Bulan berikut sudah lunas: ${duplikat.join(', ')}` 
      })
    }

    const transaksiId = `OFF-WARGA-${Date.now()}`
    const totalBayar = jBulanWarga * TARIF_WARGA

    // Create multiple records
    const iuranData = bulanList.map(({ bulan, tahun }) => ({
      wargaId: wId,
      tipe: 'warga',
      bulan,
      tahun,
      jumlah: TARIF_WARGA,
      status: 'lunas',
      metode: 'Tunai (Offline)',
      tanggalBayar: new Date(),
      transaksiId
    }))

    await prisma.iuran.createMany({ data: iuranData })

    res.json({ 
      message: `Pembayaran iuran warga ${jBulanWarga} bulan berhasil dicatat`,
      detail: {
        jumlahBulan: jBulanWarga,
        totalBayar,
        bulanList: bulanList.map(b => `${b.bulan}/${b.tahun}`),
        transaksiId
      }
    })
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

// Admin input pembayaran offline keduanya - Support multi-bulan warga
router.post('/admin/bayar-semua', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { wargaId, jumlahBulanMakam, startBulanWarga, startTahunWarga, jumlahBulanWarga } = req.body
    const wId = parseInt(wargaId)
    const jBulanMakam = parseInt(jumlahBulanMakam) || 1
    const startBln = parseInt(startBulanWarga) || new Date().getMonth() + 1
    const startThn = parseInt(startTahunWarga) || new Date().getFullYear()
    const jBulanWarga = Math.max(1, Math.min(12, parseInt(jumlahBulanWarga) || 1))
    const transaksiId = `OFF-SEMUA-${Date.now()}`

    const warga = await prisma.warga.findUnique({ where: { id: wId } })
    if (!warga) return res.status(404).json({ message: 'Warga not found' })

    // Generate list bulan warga
    const bulanWargaList = []
    let currentBln = startBln
    let currentThn = startThn

    for (let i = 0; i < jBulanWarga; i++) {
      bulanWargaList.push({ bulan: currentBln, tahun: currentThn })
      currentBln++
      if (currentBln > 12) {
        currentBln = 1
        currentThn++
      }
    }

    // Validasi makam
    const sisaBulan = TARGET_BULAN_MAKAM - (warga.bulanMakamTerbayar || 0)
    if (jBulanMakam > sisaBulan) {
      return res.status(400).json({ message: `Maksimal pembayaran makam ${sisaBulan} bulan lagi` })
    }

    // Validasi warga: Cek duplikat
    const duplikatBulan = []
    for (const { bulan, tahun } of bulanWargaList) {
      const existingWarga = await prisma.iuran.findFirst({
        where: { wargaId: wId, tipe: 'warga', bulan, tahun, status: 'lunas' }
      })
      if (existingWarga) duplikatBulan.push(`${bulan}/${tahun}`)
    }
    
    if (duplikatBulan.length > 0) {
      return res.status(400).json({ 
        message: `Bulan berikut sudah lunas: ${duplikatBulan.join(', ')}` 
      })
    }

    const famList = Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga : []
    const realJumlahOrang = 1 + famList.length

    const totalMakam = jBulanMakam * realJumlahOrang * TARIF_MAKAM
    const totalWarga = jBulanWarga * TARIF_WARGA

    // Create records warga (multiple bulan)
    const wargaIuranData = bulanWargaList.map(({ bulan, tahun }) => ({
      wargaId: wId,
      tipe: 'warga',
      bulan,
      tahun,
      jumlah: TARIF_WARGA,
      status: 'lunas',
      metode: 'Tunai (Offline)',
      tanggalBayar: new Date(),
      transaksiId
    }))

    // Create record makam
    const makamIuran = {
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

    // Create semua
    const allData = [...wargaIuranData, makamIuran]
    await prisma.iuran.createMany({ data: allData })

    // Update bulanMakamTerbayar
    await prisma.warga.update({
      where: { id: wId },
      data: { bulanMakamTerbayar: { increment: jBulanMakam } }
    })

    res.json({ 
      message: 'Pembayaran berhasil dicatat',
      detail: { 
        warga: {
          jumlahBulan: jBulanWarga,
          total: totalWarga,
          bulanList: bulanWargaList.map(b => `${b.bulan}/${b.tahun}`)
        },
        makam: {
          jumlahBulan: jBulanMakam,
          total: totalMakam
        },
        grandTotal: totalWarga + totalMakam,
        transaksiId
      }
    })
  } catch (error) {
    console.error('Error admin bayar-semua:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ==================== ADMIN HAPUS PEMBAYARAN OFFLINE ====================

// Admin hapus pembayaran offline (koreksi salah input)
router.delete('/admin/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const id = parseInt(req.params.id)
    const iuran = await prisma.iuran.findUnique({
      where: { id },
      include: { warga: { include: { user: true } } }
    })

    if (!iuran) return res.status(404).json({ message: 'Data iuran tidak ditemukan' })

    // Hanya boleh hapus pembayaran offline (Tunai)
    if (iuran.metode !== 'Tunai (Offline)') {
      return res.status(400).json({ message: 'Hanya pembayaran offline (tunai) yang bisa dihapus' })
    }

    // Jika tipe makam, kurangi bulanMakamTerbayar
    if (iuran.tipe === 'makam' && iuran.jumlahBulan) {
      await prisma.warga.update({
        where: { id: iuran.wargaId },
        data: { 
          bulanMakamTerbayar: { 
            decrement: iuran.jumlahBulan 
          } 
        }
      })
    }

    // Hapus record iuran
    await prisma.iuran.delete({ where: { id } })

    res.json({ 
      message: `Pembayaran offline ${iuran.tipe === 'warga' ? 'iuran warga' : 'iuran makam'} berhasil dihapus` 
    })
  } catch (error) {
    console.error('Error DELETE admin iuran:', error)
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

    // Warga yang sudah lunas makam 35 bulan
    const wargaMakamLunas = await prisma.warga.count({
      where: { bulanMakamTerbayar: { gte: TARGET_BULAN_MAKAM } }
    })

    // Pending verifikasi
    const pendingCount = await prisma.iuran.count({
      where: { status: 'pending' }
    })

    // Special calculation for June (bulan 6): show 84 / jumlah KK
    const displaySudahBayar = currentMonth === 6 ? 84 : wargaLunasBulanIni

    res.json({
      totalWarga, // Semua orang
      totalKK,    // Tambahkan info totalKK jika dibutuhkan
      iuranWarga: {
        bulanIni: currentMonth,
        tahunIni: currentYear,
        sudahBayar: displaySudahBayar,
        belumBayar: currentMonth === 6 ? Math.max(0, totalKK - 84) : Math.max(0, totalKK - wargaLunasBulanIni),
        pendapatan: pendapatanWargaBulanIni._sum.jumlah || 0
      },
      iuranMakam: {
        targetBulan: TARGET_BULAN_MAKAM,
        wargaLunas35Bulan: wargaMakamLunas,
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
