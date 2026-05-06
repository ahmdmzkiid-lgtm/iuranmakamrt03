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
      { expiresIn: '1d' }
    )

    res.json({ token, role: user.role, nama: user.nama })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
