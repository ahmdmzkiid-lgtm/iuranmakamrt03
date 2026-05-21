import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetIuran() {
  try {
    // Delete all iuran records
    const deletedIuran = await prisma.iuran.deleteMany({})
    console.log(`Deleted ${deletedIuran.count} iuran records`)

    // Reset bulanTerbayar to 0 for all warga
    const updatedWarga = await prisma.warga.updateMany({
      data: { bulanTerbayar: 0 }
    })
    console.log(`Reset bulanTerbayar for ${updatedWarga.count} warga`)

    console.log('Done!')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetIuran()
