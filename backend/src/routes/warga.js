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
        makam: true
      }
    })
    if (!warga) return res.status(404).json({ error: 'Data warga tidak ditemukan' })
    res.json(warga)
  } catch (error) {
    console.error('Error fetching me:', error)
    res.status(500).json({ error: 'Gagal mengambil data profil' })
  }
})

router.put('/me', verifyToken, async (req, res) => {
  try {
    const { nama, alamat, telepon, jumlahMakam, daftarAlmarhum } = req.body
    
    // Update User Nama first if provided
    if (nama) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { nama }
      })
    }

    const updatedWarga = await prisma.warga.update({
      where: { userId: req.user.id },
      data: {
        alamat,
        telepon,
        jumlahMakam: parseInt(jumlahMakam),
        daftarAlmarhum: daftarAlmarhum, // This will be stored as JSON
        isFirstLogin: false
      },
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
        makam: true
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(warga)
  } catch (error) {
    console.error('Error fetching warga:', error)
    res.status(500).json({ error: 'Gagal mengambil data warga' })
  }
})

router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { nama, nomorKK, password, alamat, telepon, jumlahMakam, bulanTerbayar } = req.body

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
        password: hashedPassword,
        role: 'warga',
        warga: {
          create: {
            alamat,
            telepon,
            jumlahMakam: jMakam,
            bulanTerbayar: bTerbayar
          }
        }
      },
      include: {
        warga: true
      }
    })

    // If there are already paid months, we can optionally generate "lunas" iurans 
    // to reflect their history. For simplicity, we just save them in bulanTerbayar.
    // The frontend target logic will use 35 - bulanTerbayar.

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
    const { nama, nomorKK, password, alamat, telepon, jumlahMakam, bulanTerbayar, daftarAlmarhum } = req.body

    const dataUser = { nama, nomorKK }
    if (password) {
      dataUser.password = await bcrypt.hash(password, 10)
    }

    const updatedWarga = await prisma.warga.update({
      where: { id },
      data: {
        alamat,
        telepon,
        jumlahMakam: parseInt(jumlahMakam),
        bulanTerbayar: parseInt(bulanTerbayar),
        daftarAlmarhum,
        user: {
          update: dataUser
        }
      },
      include: { user: true }
    })

    res.json({ message: 'Data warga berhasil diperbarui', warga: updatedWarga })
  } catch (error) {
    console.error('Error updating warga:', error)
    res.status(500).json({ error: 'Gagal memperbarui data warga' })
  }
})

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    
    // Temukan warga dulu untuk mendapatkan userId
    const warga = await prisma.warga.findUnique({ where: { id } })
    if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan' })

    // Hapus iuran terkait (opsional, tergantung kebijakan data)
    await prisma.iuran.deleteMany({ where: { wargaId: id } })
    
    // Hapus warga
    await prisma.warga.delete({ where: { id } })
    
    // Hapus user
    await prisma.user.delete({ where: { id: warga.userId } })

    res.json({ message: 'Warga berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting warga:', error)
    res.status(500).json({ error: 'Gagal menghapus warga' })
  }
})

export default router
