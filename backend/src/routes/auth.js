import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { nomorKK: identifier }
        ]
      },
      include: {
        warga: true
      }
    })

    if (!user) {
      return res.status(401).json({ message: 'Akun tidak ditemukan' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ message: 'Password salah' })
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, nama: user.nama },
      process.env.JWT_SECRET,
      { expiresIn: '1095d' }
    )

    // Check if first login for warga
    const isFirstLogin = user.role === 'warga' && user.warga?.isFirstLogin === true

    res.json({ token, role: user.role, nama: user.nama, isFirstLogin })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ message: 'No token provided' })

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

// Change password endpoint
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.id

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password baru minimal 6 karakter' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { warga: true }
    })

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' })
    }

    // If not first login, verify current password
    const isFirstLogin = user.role === 'warga' && user.warga?.isFirstLogin === true
    if (!isFirstLogin) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Password lama wajib diisi' })
      }
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return res.status(401).json({ message: 'Password lama salah' })
      }
    }

    // Password baru tidak boleh sama dengan password default (nomor KK)
    if (user.nomorKK && newPassword === user.nomorKK) {
      return res.status(400).json({ message: 'Password baru tidak boleh sama dengan nomor KK' })
    }

    // Password baru tidak boleh sama dengan password lama
    const sameAsOld = await bcrypt.compare(newPassword, user.password)
    if (sameAsOld) {
      return res.status(400).json({ message: 'Password baru tidak boleh sama dengan password lama' })
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    // If warga, set isFirstLogin to false
    if (user.warga) {
      await prisma.warga.update({
        where: { userId: userId },
        data: { isFirstLogin: false }
      })
    }

    res.json({ message: 'Password berhasil diubah' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
