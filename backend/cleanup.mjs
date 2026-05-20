import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

try {
  // 1. Delete all Iuran records
  const dIuran = await p.iuran.deleteMany()
  console.log('Deleted iuran:', dIuran.count)

  // 2. Delete all Warga records
  const dWarga = await p.warga.deleteMany()
  console.log('Deleted warga:', dWarga.count)

  // 3. Delete all Notification records
  const dNotification = await p.notification.deleteMany()
  console.log('Deleted notifications:', dNotification.count)

  // 4. Delete all User records with role 'warga'
  const dUser = await p.user.deleteMany({
    where: {
      role: 'warga'
    }
  })
  console.log('Deleted warga users:', dUser.count)

  // 5. Delete all Makam records
  const dMakam = await p.makam.deleteMany()
  console.log('Deleted makam:', dMakam.count)

} catch (error) {
  console.error('Error during cleanup:', error)
} finally {
  await p.$disconnect()
  console.log('Cleanup Done!')
}
