import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'

const router = Router()

router.get('/', verifyToken, requireRole('admin'), (req, res) => {
  res.json({ message: 'Laporan iuran makam' })
})

export default router
