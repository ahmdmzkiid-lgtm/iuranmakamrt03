import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

router.get('/', verifyToken, (req, res) => {
  res.json({ message: 'Daftar makam' })
})

export default router
