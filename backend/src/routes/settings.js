import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { storage } from '../utils/cloudinary.js'

const router = Router()
const prisma = new PrismaClient()

// Multer configuration for QRIS using Cloudinary
const upload = multer({ storage: storage })

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany()
    // Convert to key-value object
    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {})
    res.json(config)
  } catch (error) {
    console.error('Error GET settings:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Update settings (Admin only)
router.post('/', verifyToken, upload.single('qris'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const { bank_name, bank_account, bank_holder } = req.body
    const updates = []

    if (bank_name !== undefined) updates.push({ key: 'bank_name', value: bank_name })
    if (bank_account !== undefined) updates.push({ key: 'bank_account', value: bank_account })
    if (bank_holder !== undefined) updates.push({ key: 'bank_holder', value: bank_holder })
    
    if (req.file) {
      updates.push({ key: 'qris_url', value: req.file.path })
    }

    // Upsert each setting
    for (const item of updates) {
      await prisma.setting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value }
      })
    }

    res.json({ message: 'Settings updated successfully' })
  } catch (error) {
    console.error('Error POST settings:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
