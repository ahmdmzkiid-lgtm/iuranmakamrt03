import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

export default function AdminMakam() {
  const [wargaList, setWargaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => {
    const fetchWarga = async () => {
      try {
        const res = await api.get('/warga')
        setWargaList(res.data)
      } catch (error) {
        console.error('Failed to fetch warga data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchWarga()
  }, [])

  // Reset to page 1 when searching
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const totalMakam = wargaList.reduce((sum, w) => sum + (w.jumlahOrang || 1), 0)
  const totalWarga = wargaList.reduce((sum, w) => {
    const anggota = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga.length : 0
    return sum + 1 + anggota // 1 kepala keluarga + anggota
  }, 0)

  // Filter & Alphabetical Sort (A-Z)
  const filteredWarga = wargaList
    .filter(warga => {
      const query = searchQuery.toLowerCase()
      return warga.user?.nama?.toLowerCase().includes(query) ||
             warga.user?.nomorKK?.toLowerCase().includes(query) ||
             warga.alamat?.toLowerCase().includes(query)
    })
    .sort((a, b) => {
      const nameA = a.user?.nama || ''
      const nameB = b.user?.nama || ''
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
    })

  // Paginated Warga List
  const paginatedWarga = filteredWarga.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const totalPages = Math.ceil(filteredWarga.length / PAGE_SIZE) || 1

  // Export to Excel logic
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Laporan Sisa Iuran')

      // Set manual column widths
      worksheet.getColumn(1).width = 8;   // NO
      worksheet.getColumn(2).width = 35;  // NAMA
      worksheet.getColumn(3).width = 25;  // NIK
      worksheet.getColumn(4).width = 25;  // NO RUMAH
      worksheet.getColumn(5).width = 20;  // SISA BULAN

      // 1. Add Title Block
      const titleRow = worksheet.getRow(1)
      titleRow.getCell(1).value = "LAPORAN SISA BULAN IURAN MAKAM RT 03"
      titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true }
      worksheet.mergeCells('A1:E1')
      titleRow.height = 30
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

      // 2. Add Subtitle / Export Date
      const subtitleRow = worksheet.getRow(2)
      subtitleRow.getCell(1).value = `Tanggal Export: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} ${new Date().toLocaleTimeString('id-ID')}`
      subtitleRow.getCell(1).font = { name: 'Arial', size: 10, italic: true }
      worksheet.mergeCells('A2:E2')
      subtitleRow.height = 20
      subtitleRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Row 3 is blank
      worksheet.getRow(3).height = 10

      // 3. Setup Table Headers in Row 4
      const headerRow = worksheet.getRow(4)
      const headers = ['NO', 'NAMA', 'NIK', 'NO RUMAH', 'SISA BULAN']
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = h
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '000000' } // Neubrutal black background
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'medium' },
          bottom: { style: 'medium' },
          right: { style: 'medium' }
        }
      })
      headerRow.height = 25

      // 4. Populate Data Rows starting from Row 5
      filteredWarga.forEach((w, idx) => {
        const lunasBulan = w.bulanMakamTerbayar || 0
        const progressString = `${lunasBulan}/36`

        const dataRow = worksheet.getRow(5 + idx)
        dataRow.getCell(1).value = idx + 1
        dataRow.getCell(2).value = w.user?.nama || '-'
        dataRow.getCell(3).value = w.user?.nik || '-'
        dataRow.getCell(4).value = w.alamat || '-'
        dataRow.getCell(5).value = progressString

        // Center alignment and borders for all cells (centered as requested)
        for (let col = 1; col <= 5; col++) {
          dataRow.getCell(col).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          dataRow.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const dataBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(dataBlob, `Laporan-Sisa-Iuran-Makam-RT03-${new Date().toLocaleDateString('id-ID')}.xlsx`)
    } catch (error) {
      console.error('Failed to export excel:', error)
      alert('Gagal mengunduh Laporan Excel')
    }
  }

  return (
    <AdminLayout activeLabel="Kelola Iuran">
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-lg">
          <div>
            <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase">
              Kelola Iuran
            </h1>
            <p className="font-body-lg text-zinc-600 mt-2">
              Data makam dan iuran yang dikelola di lingkungan RT.
            </p>
          </div>
          <button
            onClick={handleExportExcel}
            className="bg-[#ffae19] text-black border-4 border-black px-6 py-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center justify-center gap-2 text-sm md:text-base cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined">download</span>
            Export Excel
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-lg">
          <div className="bg-primary-container border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1">
            <span className="material-symbols-outlined text-3xl mb-2 text-white">groups</span>
            <p className="font-display-bold text-2xl md:text-headline-lg text-white">{totalWarga} Warga</p>
            <p className="font-label-bold text-[10px] uppercase text-white opacity-70 mt-1">Total Warga Terdaftar</p>
          </div>
          <div className="bg-tertiary-fixed border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1">
            <span className="material-symbols-outlined text-3xl mb-2 text-black">person</span>
            <p className="font-display-bold text-2xl md:text-headline-lg text-black">{wargaList.length} KK</p>
            <p className="font-label-bold text-[10px] uppercase text-black opacity-70 mt-1">Total Kepala Keluarga</p>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white border-4 border-black neubrutal-shadow overflow-hidden">
          <div className="p-4 md:p-6 border-b-4 border-black bg-zinc-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="font-headline-md uppercase text-sm md:text-base">Daftar Makam per Warga</h2>
            <div className="flex items-center gap-2 w-full md:w-auto bg-white border-2 border-black px-3 py-1">
              <span className="material-symbols-outlined text-zinc-400">search</span>
              <input 
                type="text" 
                placeholder="Cari warga..." 
                className="w-full md:w-64 text-sm focus:outline-none bg-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-200 border-b-4 border-black font-label-bold text-xs uppercase">
                  <th className="p-4">Nama Warga (KK)</th>
                  <th className="p-4 text-center">Jml Anggota</th>
                  <th className="p-4 text-center">Iuran Makam</th>
                  <th className="p-4">No Rumah</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center">
                      <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                    </td>
                  </tr>
                ) : paginatedWarga.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center font-bold uppercase text-zinc-400">Belum ada data</td>
                  </tr>
                ) : (
                  paginatedWarga.map((warga) => {
                    const lunasBulan = warga.bulanMakamTerbayar || 0
                    const sisaBulan = Math.max(0, 36 - lunasBulan)
                    return (
                      <tr key={warga.id} className="border-b-2 border-zinc-200 hover:bg-zinc-50 transition-colors align-top">
                        <td className="p-4">
                          <p className="font-bold text-sm">{warga.user?.nama}</p>
                          <p className="text-[10px] text-zinc-500 uppercase">KK: {warga.user?.nomorKK}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-block bg-primary text-white border-2 border-black px-2 py-1 font-display-bold text-sm">
                            {warga.jumlahOrang || 1}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-block border-2 border-black px-2 py-1 font-display-bold text-sm ${sisaBulan === 0 ? 'bg-green-500 text-white' : sisaBulan <= 6 ? 'bg-tertiary-fixed text-black' : 'bg-zinc-100 text-black'}`}>
                              {lunasBulan}/36
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {sisaBulan === 0 ? 'LUNAS' : `Sisa ${sisaBulan} bln`}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-sm">{warga.alamat || '-'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 flex justify-between items-center bg-zinc-50 border-t-4 border-black">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border-2 border-black font-headline-md text-xs uppercase bg-white hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                Sebelumnya
              </button>
              <span className="font-display-bold text-xs uppercase">
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border-2 border-black font-headline-md text-xs uppercase bg-white hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
