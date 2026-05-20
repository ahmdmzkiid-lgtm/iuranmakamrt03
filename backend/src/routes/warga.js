import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const router = Router()
const prisma = new PrismaClient()

router.get('/me', verifyToken, async (req, res) => {
  try {
    const warga = await prisma.warga.findUnique({
      where: { userId: req.user.id },
      include: {
        user: true,
        makam: true,
        iuran: true
      }
    })
    if (!warga) return res.status(404).json({ error: 'Data warga tidak ditemukan' })
    
    // Hitung bulan makam yang sudah lunas
    const bulanMakamLunas = warga.iuran.filter(i => i.tipe === 'makam' && i.status === 'lunas').length
    const TOTAL_BULAN_MAKAM = 36
    const sisaBulanMakam = Math.max(0, TOTAL_BULAN_MAKAM - bulanMakamLunas)
    
    res.json({
      ...warga,
      bulanMakamLunas,
      sisaBulanMakam,
      totalBulanMakam: TOTAL_BULAN_MAKAM
    })
  } catch (error) {
    console.error('Error fetching me:', error)
    res.status(500).json({ error: 'Gagal mengambil data profil' })
  }
})

router.put('/me', verifyToken, async (req, res) => {
  try {
    const { nama, alamat, telepon, jumlahMakam, anggotaKeluarga } = req.body
    
    // Update User Nama first if provided
    if (nama) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { nama }
      })
    }

    const updateData = {
        alamat,
        telepon,
        isFirstLogin: false
      }
    if (anggotaKeluarga !== undefined) updateData.anggotaKeluarga = anggotaKeluarga

    const updatedWarga = await prisma.warga.update({
      where: { userId: req.user.id },
      data: updateData,
      include: { user: true }
    })

    res.json({ message: 'Profil berhasil diperbarui', warga: updatedWarga })
  } catch (error) {
    console.error('Error updating profile:', error)
    res.status(500).json({ error: 'Gagal memperbarui profil' })
  }
})

router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const warga = await prisma.warga.findMany({
      include: {
        user: true,
        makam: true,
        iuran: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Tambahkan info sisa bulan makam untuk setiap warga
    const TOTAL_BULAN_MAKAM = 36
    const wargaWithMakamInfo = warga.map(w => {
      const bulanMakamLunas = w.iuran.filter(i => i.tipe === 'makam' && i.status === 'lunas').length
      return {
        ...w,
        bulanMakamLunas,
        sisaBulanMakam: Math.max(0, TOTAL_BULAN_MAKAM - bulanMakamLunas),
        totalBulanMakam: TOTAL_BULAN_MAKAM
      }
    })
    
    res.json(wargaWithMakamInfo)
  } catch (error) {
    console.error('Error fetching warga:', error)
    res.status(500).json({ error: 'Gagal mengambil data warga' })
  }
})

// Bulk import warga dari Excel (must be before /:id routes)
router.post('/import', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { data } = req.body
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data import kosong' })
    }

    const results = { success: 0, failed: 0, errors: [] }
    const stripSpaces = (str) => String(str || '').replace(/\s/g, '').trim()

    for (const [index, row] of data.entries()) {
      try {
        const nomorKK = stripSpaces(row.nomorKK)
        const nama = String(row.nama || '').trim()
        const nik = stripSpaces(row.nik) || null
        const alamat = String(row.alamat || '').trim() || null
        const telepon = stripSpaces(row.telepon) || null
        const anggotaKeluarga = Array.isArray(row.anggotaKeluarga)
          ? row.anggotaKeluarga.map(a => ({ nama: String(a.nama || '').trim(), nik: stripSpaces(a.nik) }))
          : []

        if (!nama || !nomorKK) {
          results.failed++
          results.errors.push(`Baris ${index + 1}: Nama dan No KK wajib diisi`)
          continue
        }

        const existing = await prisma.user.findUnique({ where: { nomorKK } })
        if (existing) {
          results.failed++
          results.errors.push(`Baris ${index + 1}: No KK ${nomorKK} sudah terdaftar`)
          continue
        }

        const hashedPassword = await bcrypt.hash(nomorKK, 10)

        const newUser = await prisma.user.create({
          data: {
            nama,
            nomorKK,
            nik,
            password: hashedPassword,
            role: 'warga',
            warga: {
              create: {
                alamat,
                telepon,
                anggotaKeluarga
              }
            }
          },
          include: { warga: true }
        })

        // Auto-generate iuran bulan ini
        // Iuran warga: 10.000/KK
        // Iuran makam: 10.000 x (1 kepala keluarga + jumlah anggota)
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        const IURAN_PER_ORANG = 10000
        const jumlahAnggota = Array.isArray(anggotaKeluarga) ? anggotaKeluarga.length : 0
        const totalOrang = 1 + jumlahAnggota // 1 kepala keluarga + anggota

        await prisma.iuran.createMany({
          data: [
            { wargaId: newUser.warga.id, tipe: 'warga', tahun: currentYear, bulan: currentMonth, jumlah: IURAN_PER_ORANG, status: 'belum_bayar' },
            { wargaId: newUser.warga.id, tipe: 'makam', tahun: currentYear, bulan: currentMonth, jumlah: IURAN_PER_ORANG * totalOrang, status: 'belum_bayar' }
          ]
        })

        results.success++
      } catch (err) {
        results.failed++
        results.errors.push(`Baris ${index + 1}: ${err.message}`)
      }
    }

    res.json({
      message: `Import selesai. Berhasil: ${results.success}, Gagal: ${results.failed}`,
      ...results
    })
  } catch (error) {
    console.error('Error importing warga:', error)
    res.status(500).json({ error: 'Gagal mengimport data warga' })
  }
})

router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { nama, nomorKK, nik, password, alamat, telepon, jumlahMakam, bulanTerbayar, anggotaKeluarga } = req.body

    if (!nama || !nomorKK || !password) {
      return res.status(400).json({ error: 'Nama, Nomor KK, dan Password wajib diisi' })
    }

    const jMakam = parseInt(jumlahMakam) || 1
    const bTerbayar = parseInt(bulanTerbayar) || 0

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        nama,
        nomorKK,
        nik: nik || null,
        password: hashedPassword,
        role: 'warga',
        warga: {
          create: {
            alamat,
            telepon,
            jumlahMakam: jMakam,
            bulanTerbayar: bTerbayar,
            anggotaKeluarga: anggotaKeluarga || []
          }
        }
      },
      include: {
        warga: true
      }
    })

    // Auto-generate iuran bulan ini
    // Iuran warga: 10.000/KK
    // Iuran makam: 10.000 x (1 kepala keluarga + jumlah anggota)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const IURAN_PER_ORANG = 10000
    const jumlahAnggota = Array.isArray(anggotaKeluarga) ? anggotaKeluarga.length : 0
    const totalOrang = 1 + jumlahAnggota // 1 kepala keluarga + anggota

    await prisma.iuran.createMany({
      data: [
        { wargaId: newUser.warga.id, tipe: 'warga', tahun: currentYear, bulan: currentMonth, jumlah: IURAN_PER_ORANG, status: 'belum_bayar' },
        { wargaId: newUser.warga.id, tipe: 'makam', tahun: currentYear, bulan: currentMonth, jumlah: IURAN_PER_ORANG * totalOrang, status: 'belum_bayar' }
      ]
    })

    res.json({ message: 'Warga berhasil ditambahkan', user: newUser })
  } catch (error) {
    console.error('Error creating warga:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Nomor KK sudah terdaftar' })
    }
    res.status(500).json({ error: 'Gagal menambahkan warga' })
  }
})

router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { nama, nomorKK, nik, password, alamat, telepon, jumlahMakam, bulanTerbayar, anggotaKeluarga } = req.body

    console.log('Update warga:', id, req.body)

    const dataUser = {}
    if (nama !== undefined) dataUser.nama = nama
    if (nomorKK !== undefined) dataUser.nomorKK = nomorKK
    if (nik !== undefined) dataUser.nik = nik || null
    if (password) {
      dataUser.password = await bcrypt.hash(password, 10)
    }

    const wargaUpdateData = {}
    if (alamat !== undefined) wargaUpdateData.alamat = alamat
    if (telepon !== undefined) wargaUpdateData.telepon = telepon
    if (jumlahMakam !== undefined && !isNaN(parseInt(jumlahMakam))) {
      wargaUpdateData.jumlahMakam = parseInt(jumlahMakam)
    }
    // Handle bulanTerbayar - create iuran makam records
    if (bulanTerbayar !== undefined && !isNaN(parseInt(bulanTerbayar))) {
      const bulanBaru = parseInt(bulanTerbayar)
      
      // Get current warga data to check existing iuran
      const currentWarga = await prisma.warga.findUnique({
        where: { id },
        include: { iuran: true }
      })
      
      // Count existing lunas makam iuran
      const existingLunas = currentWarga.iuran.filter(i => i.tipe === 'makam' && i.status === 'lunas').length
      
      // If new bulanTerbayar is greater, create new iuran records
      if (bulanBaru > existingLunas) {
        const IURAN_PER_ORANG = 10000
        const jumlahAnggota = Array.isArray(currentWarga.anggotaKeluarga) ? currentWarga.anggotaKeluarga.length : 0
        const totalOrang = 1 + jumlahAnggota
        const nominalPerBulan = IURAN_PER_ORANG * totalOrang
        
        const now = new Date()
        let tahun = now.getFullYear()
        let bulan = now.getMonth() + 1
        
        // Create iuran for the difference
        for (let i = existingLunas; i < bulanBaru; i++) {
          // Calculate month (go backwards from current month)
          const monthOffset = bulanBaru - i - 1
          let targetBulan = bulan - monthOffset
          let targetTahun = tahun
          
          while (targetBulan <= 0) {
            targetBulan += 12
            targetTahun -= 1
          }
          
          // Check if iuran already exists for this month
          const exists = await prisma.iuran.findFirst({
            where: { wargaId: id, tahun: targetTahun, bulan: targetBulan, tipe: 'makam' }
          })
          
          if (!exists) {
            await prisma.iuran.create({
              data: {
                wargaId: id,
                tipe: 'makam',
                tahun: targetTahun,
                bulan: targetBulan,
                jumlah: nominalPerBulan,
                status: 'lunas',
                metode: 'Bayar Sebelumnya',
                tanggalBayar: new Date()
              }
            })
          } else if (exists.status !== 'lunas') {
            // Update existing to lunas
            await prisma.iuran.update({
              where: { id: exists.id },
              data: { status: 'lunas', metode: 'Bayar Sebelumnya', tanggalBayar: new Date() }
            })
          }
        }
      }
    }
    if (anggotaKeluarga !== undefined) wargaUpdateData.anggotaKeluarga = anggotaKeluarga
    
    // Only add user update if there's data to update
    if (Object.keys(dataUser).length > 0) {
      wargaUpdateData.user = { update: dataUser }
    }

    const updatedWarga = await prisma.warga.update({
      where: { id },
      data: wargaUpdateData,
      include: { user: true }
    })

    res.json({ message: 'Data warga berhasil diperbarui', warga: updatedWarga })
  } catch (error) {
    console.error('Error updating warga:', error)
    res.status(500).json({ error: 'Gagal memperbarui data warga: ' + error.message })
  }
})

// Reset password warga ke default (nomor KK)
router.post('/:id/reset-password', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    
    const warga = await prisma.warga.findUnique({
      where: { id },
      include: { user: true }
    })
    
    if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan' })
    
    // Password default = nomor KK
    const defaultPassword = warga.user.nomorKK || '123456'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)
    
    // Update password dan set isFirstLogin ke true
    await prisma.user.update({
      where: { id: warga.userId },
      data: { password: hashedPassword }
    })
    
    await prisma.warga.update({
      where: { id },
      data: { isFirstLogin: true }
    })
    
    res.json({ message: 'Password berhasil direset ke nomor KK' })
  } catch (error) {
    console.error('Error resetting password:', error)
    res.status(500).json({ error: 'Gagal mereset password: ' + error.message })
  }
})

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    
    // Temukan warga dulu untuk mendapatkan userId
    const warga = await prisma.warga.findUnique({ where: { id } })
    if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan' })

    // Hapus semua data terkait dalam transaksi
    await prisma.$transaction(async (tx) => {
      // Hapus iuran terkait
      await tx.iuran.deleteMany({ where: { wargaId: id } })
      
      // Hapus notifications terkait user
      await tx.notification.deleteMany({ where: { userId: warga.userId } })
      
      // Hapus warga
      await tx.warga.delete({ where: { id } })
      
      // Hapus user
      await tx.user.delete({ where: { id: warga.userId } })
    })

    res.json({ message: 'Warga berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting warga:', error)
    res.status(500).json({ error: 'Gagal menghapus warga: ' + error.message })
  }
})

export default router
