-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "nomorKK" TEXT,
    "nik" TEXT,
    "password" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warga" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "makamId" INTEGER,
    "alamat" TEXT,
    "telepon" TEXT,
    "jumlahMakam" INTEGER NOT NULL DEFAULT 1,
    "bulanTerbayar" INTEGER NOT NULL DEFAULT 0,
    "anggotaKeluarga" JSONB,
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Makam" (
    "id" SERIAL NOT NULL,
    "blok" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Makam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iuran" (
    "id" SERIAL NOT NULL,
    "wargaId" INTEGER NOT NULL,
    "tipe" TEXT NOT NULL DEFAULT 'makam',
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "jumlah" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "metode" TEXT,
    "buktiBayar" TEXT,
    "tanggalBayar" TIMESTAMP(3),
    "transaksiId" TEXT,
    "catatanAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iuran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nomorKK_key" ON "User"("nomorKK");

-- CreateIndex
CREATE UNIQUE INDEX "Warga_userId_key" ON "Warga"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- AddForeignKey
ALTER TABLE "Warga" ADD CONSTRAINT "Warga_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warga" ADD CONSTRAINT "Warga_makamId_fkey" FOREIGN KEY ("makamId") REFERENCES "Makam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iuran" ADD CONSTRAINT "Iuran_wargaId_fkey" FOREIGN KEY ("wargaId") REFERENCES "Warga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
