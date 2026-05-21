/*
  Warnings:

  - You are about to drop the column `bulanTerbayar` on the `Warga` table. All the data in the column will be lost.
  - You are about to drop the column `jumlahMakam` on the `Warga` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Iuran" ADD COLUMN     "jumlahBulan" INTEGER,
ADD COLUMN     "jumlahOrang" INTEGER,
ALTER COLUMN "tipe" SET DEFAULT 'warga',
ALTER COLUMN "tahun" DROP NOT NULL,
ALTER COLUMN "bulan" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Warga" DROP COLUMN "bulanTerbayar",
DROP COLUMN "jumlahMakam",
ADD COLUMN     "bulanMakamTerbayar" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jumlahOrang" INTEGER NOT NULL DEFAULT 1;
