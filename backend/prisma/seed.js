import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const hashedPassword = await bcrypt.hash('AdminRT03@!', 10)
    
    const admin = await prisma.user.upsert({
      where: { nomorKK: 'AdminRT03' },
      update: {},
      create: {
        nama: 'AdminRT03',
        nomorKK: 'AdminRT03',
        password: hashedPassword,
        role: 'admin'
      }
    })

  console.log('Seed success: Admin account created')
  console.log('Username:', admin.nomorKK)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
