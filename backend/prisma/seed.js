import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('AdminRT03@!', 10)
  
  const admin = await prisma.user.upsert({
    where: { nomorKK: 'ADMINGANTENG' },
    update: {},
    create: {
      nama: 'Admin RT 03',
      nomorKK: 'ADMINGANTENG',
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
