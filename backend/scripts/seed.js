import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const adminUsername = process.env.ADMIN_USERNAME || 'AdminRT03'
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminRT03@!'
    
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    
    const admin = await prisma.user.upsert({
      where: { nomorKK: adminUsername },
      update: {},
      create: {
        nama: adminUsername,
        nomorKK: adminUsername,
        password: hashedPassword,
        role: 'admin'
      }
    })

  console.log('Seed success: Admin account created')
  console.log('Username:', admin.nomorKK)
  console.log('Password: AdminRT03@!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
