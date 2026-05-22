import { useState, useEffect, useRef, useMemo } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function AdminIuran() {
  const [activeTab, setActiveTab] = useState('warga') // 'warga' | 'makam' | 'pending'
  const [dataIuran, setDataIuran] = useState([])
  const [wargaProgress, setWargaProgress] = useState([])
  const [statistik, setStatistik] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedBukti, setSelectedBukti] = useState(null)
  const [showRekamModal, setShowRekamModal] = useState(false)
  const [wargaList, setWargaList] = useState([])
  const [rekamData, setRekamData] = useState({ 
    wargaId: '', 
    tipe: 'semua', // 'warga' | 'makam' | 'semua'
    jumlahBulanMakam: 1,
    bulanWarga: new Date().getMonth() + 1,
    tahunWarga: new Date().getFullYear()
  })
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [wargaSearch, setWargaSearch] = useState('')
  const [showWargaDropdown, setShowWargaDropdown] = useState(false)
  
  // Delete Offline States
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  
  // Export Modal States
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportBulan, setExportBulan] = useState(new Date().getMonth() + 1)
  const [exportTahun, setExportTahun] = useState(new Date().getFullYear())
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1) // History page
  const [wargaProgressPage, setWargaProgressPage] = useState(1) // Warga list page
  const PAGE_SIZE = 10
  
  const wargaDropdownRef = useRef(null)
  const { showAlert } = useNotification()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wargaDropdownRef.current && !wargaDropdownRef.current.contains(e.target)) {
        setShowWargaDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [iuranRes, progressRes, statsRes] = await Promise.all([
        api.get('/iuran'),
        api.get('/iuran/progress'),
        api.get('/iuran/statistik')
      ])
      setDataIuran(iuranRes.data)
      setWargaProgress(progressRes.data)
      setStatistik(statsRes.data)
    } catch (error) {
      console.error('Failed to fetch data', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarga = async () => {
    try {
      const res = await api.get('/warga')
      const sortedWarga = [...res.data].sort((a, b) => {
        const nameA = a.user?.nama || ''
        const nameB = b.user?.nama || ''
        return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
      })
      setWargaList(sortedWarga)
    } catch (error) {
      console.error('Failed to fetch warga', error)
    }
  }

  useEffect(() => {
    fetchData()
    fetchWarga()
  }, [])

  const handleVerifikasi = async (id, isTransaksi = false, action) => {
    if (action === 'tolak') {
      setRejectId(id)
      setRejectReason('')
      setShowRejectModal(true)
      return
    }

    try {
      setIsProcessing(true)
      if (isTransaksi) {
        await api.put(`/iuran/verifikasi-transaksi/${id}`, { action })
      } else {
        await api.put(`/iuran/${id}/verifikasi`, { action })
      }
      await showAlert('Pembayaran berhasil diverifikasi!')
      fetchData()
    } catch (error) {
      console.error('Verifikasi error', error)
      showAlert('Gagal memverifikasi pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const submitReject = async () => {
    if (!rejectReason) return showAlert('Mohon isi alasan penolakan')
    try {
      setIsProcessing(true)
      const isTx = typeof rejectId === 'string'
      if (isTx) {
        await api.put(`/iuran/verifikasi-transaksi/${rejectId}`, { action: 'tolak', alasan: rejectReason })
      } else {
        await api.put(`/iuran/${rejectId}/verifikasi`, { action: 'tolak', alasan: rejectReason })
      }
      await showAlert('Pembayaran ditolak.')
      setShowRejectModal(false)
      fetchData()
    } catch (error) {
      console.error('Reject error', error)
      showAlert('Gagal menolak pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteOffline = async () => {
    if (!deleteTarget) return
    try {
      setIsProcessing(true)
      await api.delete(`/iuran/admin/${deleteTarget.id}`)
      await showAlert('Pembayaran offline berhasil dihapus!')
      setShowDeleteModal(false)
      setDeleteTarget(null)
      fetchData()
    } catch (error) {
      console.error('Delete offline error', error)
      showAlert(error.response?.data?.message || 'Gagal menghapus pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRekamBayar = async (e) => {
    e.preventDefault()
    if (!rekamData.wargaId) return showAlert('Pilih warga terlebih dahulu')

    try {
      setIsProcessing(true)
      let endpoint = '/iuran/admin/bayar-semua'
      let payload = {
        wargaId: rekamData.wargaId,
        jumlahBulanMakam: rekamData.jumlahBulanMakam,
        bulanWarga: rekamData.bulanWarga,
        tahunWarga: rekamData.tahunWarga
      }

      if (rekamData.tipe === 'warga') {
        endpoint = '/iuran/admin/bayar-warga'
        payload = {
          wargaId: rekamData.wargaId,
          bulan: rekamData.bulanWarga,
          tahun: rekamData.tahunWarga
        }
      } else if (rekamData.tipe === 'makam') {
        endpoint = '/iuran/admin/bayar-makam'
        payload = {
          wargaId: rekamData.wargaId,
          jumlahBulan: rekamData.jumlahBulanMakam
        }
      }

      await api.post(endpoint, payload)
      await showAlert('Pembayaran offline berhasil dicatat!')
      setShowRekamModal(false)
      setRekamData({
        wargaId: '',
        tipe: 'semua',
        jumlahBulanMakam: 1,
        bulanWarga: new Date().getMonth() + 1,
        tahunWarga: new Date().getFullYear()
      })
      setWargaSearch('')
      fetchData()
    } catch (error) {
      console.error('Rekam bayar error', error)
      showAlert(error.response?.data?.message || 'Gagal mencatat pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  // Export to Excel logic
  const handleExportExcel = async (selectedMonth, selectedYear) => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Laporan Pembayaran')

      // Set manual column widths
      worksheet.getColumn(1).width = 6;   // NO
      worksheet.getColumn(2).width = 22;  // NO KK
      worksheet.getColumn(3).width = 35;  // NAMA
      worksheet.getColumn(4).width = 25;  // NIK
      worksheet.getColumn(5).width = 18;  // IURAN MAKAM
      worksheet.getColumn(6).width = 18;  // IURAN WARGA
      worksheet.getColumn(7).width = 28;  // PERIODE
      worksheet.getColumn(8).width = 16;  // JUMLAH
      worksheet.getColumn(9).width = 20;  // METODE
      worksheet.getColumn(10).width = 18; // TANGGAL BAYAR

      // 1. Add Title Block in Laporan Pembayaran
      const titleRow = worksheet.getRow(1)
      titleRow.getCell(1).value = "LAPORAN BULANAN IURAN RT 03"
      titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true }
      worksheet.mergeCells('A1:J1')
      titleRow.height = 30
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

      // 2. Add Subtitle / Export Date & Selected Month Info
      const subtitleRow = worksheet.getRow(2)
      subtitleRow.getCell(1).value = `Periode Laporan: ${getBulanName(selectedMonth)} ${selectedYear} | Tanggal Export: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
      subtitleRow.getCell(1).font = { name: 'Arial', size: 10, italic: true }
      worksheet.mergeCells('A2:J2')
      subtitleRow.height = 20
      subtitleRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Row 3 is blank
      worksheet.getRow(3).height = 10

      // 3. Setup Table Headers in Row 4
      const headerRow = worksheet.getRow(4)
      const headers = ['NO', 'NO KK', 'NAMA', 'NIK', 'IURAN MAKAM', 'IURAN WARGA', 'PERIODE', 'JUMLAH', 'METODE', 'TANGGAL BAYAR']
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

      // Filter only LUNAS payments for selected month and year based on PAYMENT DATE (tanggalBayar or createdAt)
      const lunasIurans = dataIuran.filter(i => i.status === 'lunas').filter(row => {
        const payDateStr = row.tanggalBayar || row.createdAt
        if (!payDateStr) return false
        const payDate = new Date(payDateStr)
        return (payDate.getMonth() + 1) === selectedMonth && payDate.getFullYear() === selectedYear
      })

      // Group lunas payments by wargaId to prevent duplicate KK rows
      const groupedLunas = {}
      lunasIurans.forEach(row => {
        const wId = row.wargaId
        if (!groupedLunas[wId]) {
          groupedLunas[wId] = {
            warga: row.warga,
            totalMakam: 0,
            totalWarga: 0,
            totalJumlah: 0,
            metodes: new Set(),
            tanggalBayars: [],
            makamPeriodes: [],
            wargaPeriodes: []
          }
        }
        
        const group = groupedLunas[wId]
        if (row.tipe === 'makam') {
          group.totalMakam += Number(row.jumlah)
          group.makamPeriodes.push(`Makam (${row.jumlahBulan || 1} Bulan)`)
        } else if (row.tipe === 'warga') {
          group.totalWarga += Number(row.jumlah)
          group.wargaPeriodes.push(`${getBulanName(row.bulan)} ${row.tahun}`)
        }
        group.totalJumlah += Number(row.jumlah)
        if (row.metode) {
          group.metodes.add(row.metode)
        }
        
        const dateObj = row.tanggalBayar ? new Date(row.tanggalBayar) : (row.createdAt ? new Date(row.createdAt) : null)
        if (dateObj) {
          group.tanggalBayars.push(dateObj)
        }
      })

      // Warga who have not paid anything (neither warga nor makam) in this month/year
      const paidWargaIds = new Set(Object.keys(groupedLunas).map(id => Number(id)))
      const unpaidWarga = wargaList.filter(w => !paidWargaIds.has(w.id))

      let totalSumMakam = 0
      let totalSumWarga = 0
      let totalSumGrand = 0
      let rowIdxCounter = 1

      // Sort alphabetically by KK name (Kepala Keluarga)
      const sortedGroupedLunas = Object.values(groupedLunas).sort((a, b) => {
        const nameA = a.warga?.user?.nama || ''
        const nameB = b.warga?.user?.nama || ''
        return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
      })

      const sortedUnpaidWarga = [...unpaidWarga].sort((a, b) => {
        const nameA = a.user?.nama || ''
        const nameB = b.user?.nama || ''
        return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
      })

      // 4. Populate "SUDAH BAYAR" Rows
      sortedGroupedLunas.forEach((group) => {
        const namesList = []
        const niksList = []

        const kkNama = group.warga?.user?.nama || ''
        const kkNik = group.warga?.user?.nik || ''
        namesList.push(kkNama)
        niksList.push(kkNik || '-')

        const famList = Array.isArray(group.warga?.anggotaKeluarga) ? group.warga.anggotaKeluarga : []
        famList.forEach(m => {
          namesList.push(m.nama || '')
          niksList.push(m.nik || '-')
        })

        const namesString = namesList.join('\r\n')
        const niksString = niksList.join('\r\n')

        const nominalMakam = group.totalMakam
        const nominalWarga = group.totalWarga

        totalSumMakam += nominalMakam
        totalSumWarga += nominalWarga
        totalSumGrand += group.totalJumlah

        const dataRow = worksheet.getRow(5 + rowIdxCounter - 1)
        dataRow.getCell(1).value = rowIdxCounter // NO
        dataRow.getCell(2).value = group.warga?.user?.nomorKK || '-' // NO KK
        dataRow.getCell(3).value = namesString // NAMA
        dataRow.getCell(4).value = niksString // NIK
        dataRow.getCell(5).value = nominalMakam > 0 ? nominalMakam : 0 // IURAN MAKAM
        dataRow.getCell(6).value = nominalWarga > 0 ? nominalWarga : 0 // IURAN WARGA
        
        // Consistent format: Makam first, then Warga, separated by ' / '
        const periodParts = []
        if (group.makamPeriodes.length > 0) {
          periodParts.push(group.makamPeriodes.join(', '))
        }
        if (group.wargaPeriodes.length > 0) {
          periodParts.push(group.wargaPeriodes.join(', '))
        }
        dataRow.getCell(7).value = periodParts.length > 0 ? periodParts.join(' / ') : '-' // PERIODE
        dataRow.getCell(8).value = group.totalJumlah // JUMLAH
        dataRow.getCell(9).value = Array.from(group.metodes).join(', ') || '-' // METODE
        
        const formattedDates = group.tanggalBayars
          .map(d => d.toLocaleDateString('id-ID'))
          .filter((v, i, self) => self.indexOf(v) === i)
          .join(', ')
        dataRow.getCell(10).value = formattedDates || '-' // TANGGAL BAYAR

        // Format all cells: NAMA left-aligned, others center-aligned
        for (let col = 1; col <= 10; col++) {
          dataRow.getCell(col).alignment = { 
            vertical: 'middle', 
            horizontal: col === 3 ? 'left' : 'center', 
            wrapText: true 
          }
          dataRow.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        }

        // Numbers formatting
        dataRow.getCell(5).numFmt = '#,##0'
        dataRow.getCell(6).numFmt = '#,##0'
        dataRow.getCell(8).numFmt = '#,##0'

        // Explicit row height for mobile Excel compatibility
        const lineCount = namesList.length
        dataRow.height = Math.max(25, lineCount * 18)

        rowIdxCounter++
      })

      // 5. Populate "BELUM BAYAR" Rows (below the paid ones)
      sortedUnpaidWarga.forEach((w) => {
        const namesList = []
        const niksList = []

        const kkNama = w.user?.nama || ''
        const kkNik = w.user?.nik || ''
        namesList.push(kkNama)
        niksList.push(kkNik || '-')

        const famList = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga : []
        famList.forEach(m => {
          namesList.push(m.nama || '')
          niksList.push(m.nik || '-')
        })

        const namesString = namesList.join('\r\n')
        const niksString = niksList.join('\r\n')

        const dataRow = worksheet.getRow(5 + rowIdxCounter - 1)
        dataRow.getCell(1).value = rowIdxCounter // NO
        dataRow.getCell(2).value = w.user?.nomorKK || '-' // NO KK
        dataRow.getCell(3).value = namesString // NAMA
        dataRow.getCell(4).value = niksString // NIK
        dataRow.getCell(5).value = '-' // IURAN MAKAM
        dataRow.getCell(6).value = '-' // IURAN WARGA
        dataRow.getCell(7).value = `${getBulanName(selectedMonth)} ${selectedYear} (BELUM BAYAR)` // PERIODE
        dataRow.getCell(8).value = '-' // JUMLAH
        dataRow.getCell(9).value = '-' // METODE
        dataRow.getCell(10).value = '-' // TANGGAL BAYAR

        // Format all cells: NAMA left-aligned, others center-aligned
        for (let col = 1; col <= 10; col++) {
          dataRow.getCell(col).alignment = { 
            vertical: 'middle', 
            horizontal: col === 3 ? 'left' : 'center', 
            wrapText: true 
          }
          dataRow.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        }

        // Explicit row height for mobile Excel compatibility
        const lineCount = namesList.length
        dataRow.height = Math.max(25, lineCount * 18)

        rowIdxCounter++
      })

      // 6. Add Bottom Total Row
      const totalRowIndex = 5 + rowIdxCounter - 1
      const totalRow = worksheet.getRow(totalRowIndex)
      totalRow.getCell(1).value = "TOTAL PENERIMAAN"
      worksheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`)
      totalRow.getCell(1).font = { name: 'Arial', size: 11, bold: true }
      totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      totalRow.getCell(5).value = totalSumMakam
      totalRow.getCell(6).value = totalSumWarga
      totalRow.getCell(8).value = totalSumGrand

      totalRow.getCell(5).font = { name: 'Arial', size: 11, bold: true }
      totalRow.getCell(6).font = { name: 'Arial', size: 11, bold: true }
      totalRow.getCell(8).font = { name: 'Arial', size: 11, bold: true }

      totalRow.getCell(5).numFmt = '#,##0'
      totalRow.getCell(6).numFmt = '#,##0'
      totalRow.getCell(8).numFmt = '#,##0'

      for (let col = 1; col <= 10; col++) {
        totalRow.getCell(col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'double' },
          right: { style: 'thin' }
        }
        totalRow.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F2F2F2' }
        }
      }
      totalRow.height = 25

      // 7. Create Sheet 2: Ringkasan
      const summarySheet = workbook.addWorksheet('Ringkasan Penerimaan')
      summarySheet.getColumn(1).width = 35 // KATEGORI
      summarySheet.getColumn(2).width = 25 // TOTAL

      // Title in summary sheet
      const sumTitleRow = summarySheet.getRow(1)
      sumTitleRow.getCell(1).value = "RINGKASAN PENERIMAAN IURAN RT 03"
      sumTitleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true }
      summarySheet.mergeCells('A1:B1')
      sumTitleRow.height = 30
      sumTitleRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Subtitle in summary sheet
      const sumSubtitleRow = summarySheet.getRow(2)
      sumSubtitleRow.getCell(1).value = `Periode Laporan: ${getBulanName(selectedMonth)} ${selectedYear}`
      sumSubtitleRow.getCell(1).font = { name: 'Arial', size: 10, italic: true }
      summarySheet.mergeCells('A2:B2')
      sumSubtitleRow.height = 20
      sumSubtitleRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Headers in summary sheet
      const sumHeaderRow = summarySheet.getRow(4)
      sumHeaderRow.getCell(1).value = "KATEGORI PENERIMAAN"
      sumHeaderRow.getCell(2).value = "TOTAL NOMINAL"
      for (let col = 1; col <= 2; col++) {
        const cell = sumHeaderRow.getCell(col)
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '000000' }
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'medium' },
          bottom: { style: 'medium' },
          right: { style: 'medium' }
        }
      }
      sumHeaderRow.height = 25

      // Rows
      const r1 = summarySheet.getRow(5)
      r1.getCell(1).value = "Total Penerimaan Iuran Warga"
      r1.getCell(2).value = totalSumWarga

      const r2 = summarySheet.getRow(6)
      r2.getCell(1).value = "Total Penerimaan Iuran Makam"
      r2.getCell(2).value = totalSumMakam

      const r3 = summarySheet.getRow(7)
      r3.getCell(1).value = "GRAND TOTAL PENERIMAAN"
      r3.getCell(2).value = totalSumGrand

      // Format Summary
      const summaryRows = [r1, r2, r3]
      summaryRows.forEach((r, i) => {
        r.height = 25
        r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' } // CENTER as requested
        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' } // CENTER as requested
        r.getCell(2).numFmt = 'Rp #,##0'

        const isTotal = i === 2
        for (let col = 1; col <= 2; col++) {
          r.getCell(col).font = { name: 'Arial', size: 11, bold: isTotal }
          r.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: isTotal ? 'double' : 'thin' },
            right: { style: 'thin' }
          }
          if (isTotal) {
            r.getCell(col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD54F' }
            }
          }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const dataBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(dataBlob, `Laporan-Iuran-${getBulanName(selectedMonth)}-${selectedYear}-RT03.xlsx`)
      showAlert(`Laporan Excel bulan ${getBulanName(selectedMonth)} ${selectedYear} berhasil diunduh!`)
      setShowExportModal(false)
    } catch (error) {
      console.error('Failed to export excel:', error)
      showAlert('Gagal mengunduh Laporan Excel')
    }
  }

  // Group pending items
  const pendingTransactions = useMemo(() => {
    const pendingList = dataIuran.filter(i => i.status === 'pending')
    const grouped = {}

    pendingList.forEach(item => {
      const key = item.transaksiId || `SINGLE-${item.id}`
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          isTx: !!item.transaksiId,
          warga: item.warga,
          items: [],
          total: 0,
          buktiBayar: item.buktiBayar,
          metode: item.metode,
          tanggalBayar: item.tanggalBayar
        }
      }
      grouped[key].items.push(item)
      grouped[key].total += Number(item.jumlah)
    })

    return Object.values(grouped)
  }, [dataIuran])

  // Filter and sort Warga Progress (ALPHABETICAL)
  const sortedWargaProgress = useMemo(() => {
    const filtered = !wargaSearch 
      ? wargaProgress 
      : wargaProgress.filter(w => 
          w.nama.toLowerCase().includes(wargaSearch.toLowerCase()) || 
          w.nomorKK?.includes(wargaSearch)
        )
    
    // Sort Alphabetically by Warga/KK Name
    return [...filtered].sort((a, b) => 
      (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' })
    )
  }, [wargaProgress, wargaSearch])

  // PAGINATION for Warga Progress
  const paginatedWargaProgress = useMemo(() => {
    const start = (wargaProgressPage - 1) * PAGE_SIZE
    return sortedWargaProgress.slice(start, start + PAGE_SIZE)
  }, [sortedWargaProgress, wargaProgressPage])

  const totalWargaProgressPages = Math.ceil(sortedWargaProgress.length / PAGE_SIZE) || 1
  const wargaProgressStartIndex = sortedWargaProgress.length === 0 ? 0 : (wargaProgressPage - 1) * PAGE_SIZE + 1
  const wargaProgressEndIndex = Math.min(wargaProgressPage * PAGE_SIZE, sortedWargaProgress.length)

  const getWargaProgressPageNumbers = () => {
    const pages = []
    const range = 1
    for (let i = 1; i <= totalWargaProgressPages; i++) {
      if (
        i === 1 ||
        i === totalWargaProgressPages ||
        (i >= wargaProgressPage - range && i <= wargaProgressPage + range)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  // Filter and Paginate History
  const filteredHistory = useMemo(() => {
    return dataIuran.filter(i => 
      i.status === 'lunas' || i.status === 'ditolak'
    ).filter(i => {
      if (activeTab === 'pending') return false
      return i.tipe === activeTab
    })
  }, [dataIuran, activeTab])

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredHistory.slice(start, start + PAGE_SIZE)
  }, [filteredHistory, currentPage])

  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE) || 1
  const historyStartIndex = filteredHistory.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const historyEndIndex = Math.min(currentPage * PAGE_SIZE, filteredHistory.length)

  const getHistoryPageNumbers = () => {
    const pages = []
    const range = 1
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - range && i <= currentPage + range)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  // Reset pagination when tab/search changes
  useEffect(() => {
    setCurrentPage(1)
    setWargaProgressPage(1)
  }, [activeTab, wargaSearch])

  const selectedWargaLabel = useMemo(() => {
    const selected = wargaList.find(w => w.id === parseInt(rekamData.wargaId))
    return selected ? `${selected.user?.nama} (${selected.user?.nomorKK})` : ''
  }, [rekamData.wargaId, wargaList])

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-bold text-3xl md:text-4xl uppercase leading-none">Kelola Pembayaran</h1>
            <p className="font-body-md text-zinc-600 mt-2">
              Sistem iuran bulanan warga dan pembayaran makam (36 bulan wajib bayar).
            </p>
          </div>
          <div className="flex flex-row items-center gap-3 w-full md:w-auto overflow-x-auto pb-1">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex-1 md:flex-none bg-[#ffae19] text-black border-4 border-black px-4 md:px-6 py-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center justify-center gap-2 text-xs md:text-base cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined">download</span>
              Export Excel Report
            </button>
            <button 
              onClick={() => {
                setShowRekamModal(true)
                setWargaSearch('')
                setRekamData({
                  wargaId: '',
                  tipe: 'semua',
                  jumlahBulanMakam: 1,
                  bulanWarga: new Date().getMonth() + 1,
                  tahunWarga: new Date().getFullYear()
                })
              }}
              className="flex-1 md:flex-none bg-primary text-white border-4 border-black px-4 md:px-6 py-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center justify-center gap-2 text-xs md:text-base cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined">payments</span>
              Rekam Bayar Offline
            </button>
          </div>
        </header>

        {/* Statistik Cards */}
        {statistik && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-primary-container text-white border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-80">Total Warga (Jiwa)</p>
              <p className="text-3xl font-display-bold mt-1">{statistik.totalWarga} Orang</p>
              <p className="text-xs font-bold mt-2 text-white/70">Terdaftar di {statistik.totalKK} KK</p>
            </div>
            <div className="bg-secondary-container text-black border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-70">Iuran Warga Bulan Ini</p>
              <p className="text-3xl font-display-bold mt-1">{statistik.iuranWarga?.sudahBayar} / {statistik.totalKK} KK</p>
              <p className="text-xs font-bold mt-2 text-zinc-600">Pendapatan: {formatRp(statistik.iuranWarga?.pendapatan)}</p>
            </div>
            <div className="bg-tertiary-fixed text-black border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-70">Makam Lunas (36 Bln)</p>
              <p className="text-3xl font-display-bold mt-1">{statistik.iuranMakam?.wargaLunas36Bulan} KK</p>
              <p className="text-xs font-bold mt-2 text-zinc-600">Total Masuk: {formatRp(statistik.iuranMakam?.totalPendapatan)}</p>
            </div>
            <div className="bg-white text-black border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-70">Pending Konfirmasi</p>
              <p className="text-3xl font-display-bold mt-1 text-primary">{statistik.pendingVerifikasi}</p>
              <p className="text-xs font-bold mt-2 text-zinc-500">Butuh Verifikasi Segera</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b-4 border-black mb-6 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('warga')}
            className={`px-6 py-3 font-headline-md uppercase text-sm md:text-base border-4 border-b-0 border-black transition-all ${
              activeTab === 'warga' 
                ? 'bg-primary-container text-white translate-y-1' 
                : 'bg-white hover:bg-zinc-100'
            }`}
          >
            Iuran Warga (Bulanan)
          </button>
          <button
            onClick={() => setActiveTab('makam')}
            className={`px-6 py-3 font-headline-md uppercase text-sm md:text-base border-4 border-b-0 border-black transition-all ${
              activeTab === 'makam' 
                ? 'bg-tertiary-fixed text-black translate-y-1' 
                : 'bg-white hover:bg-zinc-100'
            }`}
          >
            Iuran Makam (36 Bulan)
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 font-headline-md uppercase text-sm md:text-base border-4 border-b-0 border-black transition-all relative ${
              activeTab === 'pending' 
                ? 'bg-black text-white translate-y-1' 
                : 'bg-white hover:bg-zinc-100'
            }`}
          >
            Pending Verifikasi
            {pendingTransactions.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-error text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-black font-bold">
                {pendingTransactions.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'pending' ? (
          /* PENDING TAB */
          <div className="space-y-4">
            {pendingTransactions.length === 0 ? (
              <div className="bg-zinc-100 border-4 border-black p-8 text-center font-headline-md uppercase text-sm">
                Tidak ada pembayaran pending verifikasi.
              </div>
            ) : (
              pendingTransactions.map(tx => (
                <div key={tx.id} className="bg-white border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-zinc-100 border-2 border-black flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-2xl">receipt_long</span>
                    </div>
                    <div>
                      <p className="font-display-bold text-lg leading-tight">{tx.warga?.user?.nama}</p>
                      <p className="text-xs font-bold text-zinc-500 uppercase mt-1">No. KK: {tx.warga?.user?.nomorKK}</p>
                      <div className="mt-2 space-y-1">
                        {tx.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className={`inline-block px-1.5 py-0.5 border border-black font-bold text-[9px] uppercase ${item.tipe === 'warga' ? 'bg-primary-container text-white' : 'bg-tertiary-fixed'}`}>
                              {item.tipe === 'warga' ? 'Warga' : 'Makam'}
                            </span>
                            <span className="font-medium text-zinc-700">
                              {item.tipe === 'warga' 
                                ? `Bulan ${getBulanName(item.bulan)} ${item.tahun}`
                                : `Makam ${item.jumlahBulan} Bulan (${item.jumlahOrang} Orang)`}
                            </span>
                            <span className="font-bold">- {formatRp(item.jumlah)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-3 w-full md:w-auto border-t-2 md:border-t-0 border-black/10 pt-4 md:pt-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs uppercase text-zinc-400 font-bold">Total Transfer</span>
                      <p className="text-xl font-display-bold text-primary">{formatRp(tx.total)}</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={() => setSelectedBukti(tx.buktiBayar)}
                        className="flex-1 md:flex-none px-3 py-2 border-2 border-black bg-white hover:bg-zinc-100 font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Bukti
                      </button>
                      <button
                        onClick={() => handleVerifikasi(tx.id, tx.isTx, 'terima')}
                        disabled={isProcessing}
                        className="flex-1 md:flex-none px-4 py-2 border-2 border-black bg-secondary-container hover:bg-secondary-container/90 font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Setujui
                      </button>
                      <button
                        onClick={() => handleVerifikasi(tx.id, tx.isTx, 'tolak')}
                        disabled={isProcessing}
                        className="flex-1 md:flex-none px-4 py-2 border-2 border-black bg-error text-white hover:bg-error/90 font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'warga' ? (
          /* WARGA TAB (Bulanan) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Progress per KK (PAGINATED & ALPHABETICAL) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100 flex items-center justify-between">
                  <h3 className="font-headline-md uppercase text-sm">Status Bulan Ini ({getBulanName(new Date().getMonth() + 1)})</h3>
                  <input
                    type="text"
                    placeholder="Cari warga..."
                    value={wargaSearch}
                    onChange={(e) => setWargaSearch(e.target.value)}
                    className="border-2 border-black p-1.5 text-xs focus:ring-0 outline-none w-48 bg-white"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b-2 border-black">
                      <tr>
                        <th className="p-3 font-label-bold uppercase text-xs">Warga / KK (A-Z)</th>
                        <th className="p-3 font-label-bold uppercase text-xs text-center">Iuran Warga</th>
                        <th className="p-3 font-label-bold uppercase text-xs text-center">Sisa Makam</th>
                        <th className="p-3 font-label-bold uppercase text-xs text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedWargaProgress.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-xs font-bold uppercase text-zinc-500">Tidak ada data warga</td>
                        </tr>
                      ) : (
                        paginatedWargaProgress.map(w => (
                          <tr key={w.id} className="border-b border-black/10 hover:bg-zinc-50">
                            <td className="p-3">
                              <p className="font-bold text-sm">{w.nama}</p>
                              <p className="text-[10px] font-medium text-zinc-500 mt-0.5">KK: {w.nomorKK}</p>
                            </td>
                            <td className="p-3 text-center">
                              {w.wargaBulanIniLunas ? (
                                <span className="inline-block px-2 py-0.5 border border-black bg-secondary-container text-[9px] font-black uppercase text-black">
                                  LUNAS
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 border border-black bg-error text-[9px] font-black uppercase text-white">
                                  BELUM
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-sm">
                              {w.makamLunas ? (
                                <span className="inline-block px-2 py-0.5 border border-black bg-secondary-container text-[9px] font-black uppercase text-black">
                                  LUNAS 36 BLN
                                </span>
                              ) : (
                                <span className="font-mono text-xs">{w.sisaBulanMakam} bulan</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-xs font-bold uppercase text-zinc-500">
                                {w.jumlahOrang} Orang
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Warga List */}
                {!loading && sortedWargaProgress.length > 0 && (
                  <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-white border-t-2 border-black">
                    <p className="font-label-bold text-xs uppercase text-center md:text-left">Menampilkan {wargaProgressStartIndex}-{wargaProgressEndIndex} dari {sortedWargaProgress.length} warga</p>
                    <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                      <button 
                        onClick={() => setWargaProgressPage(prev => Math.max(prev - 1, 1))}
                        disabled={wargaProgressPage === 1}
                        className={`w-10 h-10 border-2 border-black flex items-center justify-center transition-all ${
                          wargaProgressPage === 1 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      {getWargaProgressPageNumbers().map((page, idx) => (
                        page === '...' ? (
                          <span 
                            key={`dots-${idx}`}
                            className="w-10 h-10 border-2 border-black flex items-center justify-center font-label-bold bg-white text-zinc-400"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setWargaProgressPage(page)}
                            className={`w-10 h-10 border-2 border-black flex items-center justify-center transition-all font-label-bold ${
                              wargaProgressPage === page
                                ? 'bg-primary text-white neubrutal-shadow'
                                : 'bg-white hover:bg-tertiary-fixed'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      <button 
                        onClick={() => setWargaProgressPage(prev => Math.min(prev + 1, totalWargaProgressPages))}
                        disabled={wargaProgressPage === totalWargaProgressPages}
                        className={`w-10 h-10 border-2 border-black flex items-center justify-center transition-all ${
                          wargaProgressPage === totalWargaProgressPages 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: History Iuran Warga */}
            <div className="space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100">
                  <h3 className="font-headline-md uppercase text-sm">Riwayat Laporan Lunas</h3>
                </div>
                <div className="divide-y border-b border-black">
                  {paginatedHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs font-bold text-zinc-500 uppercase">Belum ada riwayat</div>
                  ) : (
                    paginatedHistory.map(row => (
                      <div key={row.id} className="p-3 hover:bg-zinc-50 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-bold text-xs">{row.warga?.user?.nama}</p>
                          <p className="text-[9px] font-bold text-zinc-500 mt-0.5">
                            Bulan {getBulanName(row.bulan)} {row.tahun} • {row.metode || 'Offline'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-mono font-bold text-xs">{formatRp(row.jumlah)}</p>
                          {row.metode === 'Tunai (Offline)' && row.status === 'lunas' && (
                            <button
                              onClick={() => {
                                setDeleteTarget(row)
                                setShowDeleteModal(true)
                              }}
                              className="w-7 h-7 border-2 border-black bg-error/10 hover:bg-error hover:text-white text-error flex items-center justify-center transition-all cursor-pointer"
                              title="Hapus pembayaran offline"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {!loading && filteredHistory.length > 0 && (
                  <div className="p-4 flex flex-col items-center gap-3 bg-white border-t-2 border-black">
                    <p className="font-label-bold text-[10px] uppercase text-center">Menampilkan {historyStartIndex}-{historyEndIndex} dari {filteredHistory.length} riwayat</p>
                    <div className="flex flex-wrap justify-center gap-1">
                      <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all ${
                          currentPage === 1 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                      </button>
                      {getHistoryPageNumbers().map((page, idx) => (
                        page === '...' ? (
                          <span 
                            key={`dots-${idx}`}
                            className="w-8 h-8 border-2 border-black flex items-center justify-center font-label-bold bg-white text-zinc-400 text-xs"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all font-label-bold text-xs ${
                              currentPage === page
                                ? 'bg-primary text-white neubrutal-shadow'
                                : 'bg-white hover:bg-tertiary-fixed'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all ${
                          currentPage === totalPages 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* MAKAM TAB (36 Bulan) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Progress makam per KK (PAGINATED & ALPHABETICAL) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100 flex items-center justify-between">
                  <h3 className="font-headline-md uppercase text-sm">Progress Iuran Makam Warga</h3>
                  <input
                    type="text"
                    placeholder="Cari warga..."
                    value={wargaSearch}
                    onChange={(e) => setWargaSearch(e.target.value)}
                    className="border-2 border-black p-1.5 text-xs focus:ring-0 outline-none w-48 bg-white"
                  />
                </div>
                <div className="divide-y">
                  {paginatedWargaProgress.length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold uppercase text-zinc-500">Tidak ada data warga</div>
                  ) : (
                    paginatedWargaProgress.map(w => {
                      const percentage = Math.min(100, Math.round((w.bulanMakamTerbayar / 36) * 100))
                      return (
                        <div key={w.id} className="p-4 hover:bg-zinc-50 flex flex-col md:flex-row justify-between md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-baseline justify-between">
                              <p className="font-bold text-sm">{w.nama}</p>
                              <span className="text-xs font-mono font-bold text-zinc-600">
                                {w.bulanMakamTerbayar} / 36 bulan
                              </span>
                            </div>
                            <p className="text-[10px] font-medium text-zinc-500 mt-0.5">
                              Jumlah anggota keluarga: {w.jumlahOrang} Orang • Total Iuran: {formatRp(36 * w.jumlahOrang * 10000)}
                            </p>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-zinc-200 border-2 border-black h-4 mt-2 overflow-hidden relative">
                              <div 
                                className="bg-tertiary-fixed h-full border-r-2 border-black transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-black">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="shrink-0 text-right">
                            {w.makamLunas ? (
                              <span className="inline-block px-3 py-1 border-2 border-black bg-secondary-container text-[10px] font-black uppercase text-black">
                                LUNAS MAKAM
                              </span>
                            ) : (
                              <p className="text-xs font-bold text-error">Sisa: {w.sisaBulanMakam} bulan lagi</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Pagination for Warga List in Makam Tab */}
                {!loading && sortedWargaProgress.length > 0 && (
                  <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-white border-t-2 border-black">
                    <p className="font-label-bold text-xs uppercase text-center md:text-left">Menampilkan {wargaProgressStartIndex}-{wargaProgressEndIndex} dari {sortedWargaProgress.length} warga</p>
                    <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                      <button 
                        onClick={() => setWargaProgressPage(prev => Math.max(prev - 1, 1))}
                        disabled={wargaProgressPage === 1}
                        className={`w-10 h-10 border-2 border-black flex items-center justify-center transition-all ${
                          wargaProgressPage === 1 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      {getWargaProgressPageNumbers().map((page, idx) => (
                        page === '...' ? (
                          <span 
                            key={`dots-${idx}`}
                            className="w-10 h-10 border-2 border-black flex items-center justify-center font-label-bold bg-white text-zinc-400"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setWargaProgressPage(page)}
                            className={`w-10 h-10 border-2 border-black flex items-center justify-center transition-all font-label-bold ${
                              wargaProgressPage === page
                                ? 'bg-primary text-white neubrutal-shadow'
                                : 'bg-white hover:bg-tertiary-fixed'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      <button 
                        onClick={() => setWargaProgressPage(prev => Math.min(prev + 1, totalWargaProgressPages))}
                        disabled={wargaProgressPage === totalWargaProgressPages}
                        className={`w-10 h-10 border-2 border-black flex items-center justify-center transition-all ${
                          wargaProgressPage === totalWargaProgressPages 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: History Cicilan Makam */}
            <div className="space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100">
                  <h3 className="font-headline-md uppercase text-sm">Riwayat Pembayaran Makam</h3>
                </div>
                <div className="divide-y border-b border-black">
                  {paginatedHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs font-bold text-zinc-500 uppercase">Belum ada riwayat</div>
                  ) : (
                    paginatedHistory.map(row => (
                      <div key={row.id} className="p-3 hover:bg-zinc-50 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-bold text-xs">{row.warga?.user?.nama}</p>
                          <p className="text-[9px] font-bold text-zinc-500 mt-0.5">
                            Bayar {row.jumlahBulan} bulan ({row.jumlahOrang} Orang) • {row.metode || 'Offline'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-mono font-bold text-xs">{formatRp(row.jumlah)}</p>
                          {row.metode === 'Tunai (Offline)' && row.status === 'lunas' && (
                            <button
                              onClick={() => {
                                setDeleteTarget(row)
                                setShowDeleteModal(true)
                              }}
                              className="w-7 h-7 border-2 border-black bg-error/10 hover:bg-error hover:text-white text-error flex items-center justify-center transition-all cursor-pointer"
                              title="Hapus pembayaran offline"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {!loading && filteredHistory.length > 0 && (
                  <div className="p-4 flex flex-col items-center gap-3 bg-white border-t-2 border-black">
                    <p className="font-label-bold text-[10px] uppercase text-center">Menampilkan {historyStartIndex}-{historyEndIndex} dari {filteredHistory.length} riwayat</p>
                    <div className="flex flex-wrap justify-center gap-1">
                      <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all ${
                          currentPage === 1 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                      </button>
                      {getHistoryPageNumbers().map((page, idx) => (
                        page === '...' ? (
                          <span 
                            key={`dots-${idx}`}
                            className="w-8 h-8 border-2 border-black flex items-center justify-center font-label-bold bg-white text-zinc-400 text-xs"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all font-label-bold text-xs ${
                              currentPage === page
                                ? 'bg-primary text-white neubrutal-shadow'
                                : 'bg-white hover:bg-tertiary-fixed'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all ${
                          currentPage === totalPages 
                            ? 'bg-surface-variant opacity-50 cursor-not-allowed' 
                            : 'bg-white hover:bg-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Lihat Bukti */}
        {selectedBukti && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-xl neubrutal-shadow flex flex-col max-h-[85vh]">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-zinc-100">
                <h2 className="font-display-bold text-xl uppercase">Bukti Pembayaran</h2>
                <button onClick={() => setSelectedBukti(null)} className="hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-6 flex justify-center bg-zinc-50 flex-1 overflow-y-auto">
                <img 
                  src={selectedBukti} 
                  alt="Bukti Transfer" 
                  className="max-h-[60vh] object-contain border-4 border-black shadow-lg bg-white"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/400x600?text=Bukti+Tidak+Ditemukan';
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Reject / Penolakan */}
        {showRejectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow">
              <div className="p-4 border-b-4 border-black bg-error text-white">
                <h2 className="font-display-bold text-lg uppercase">Tolak Pembayaran</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block font-label-bold uppercase mb-2">Alasan Penolakan</label>
                  <textarea
                    rows="3"
                    className="w-full border-4 border-black p-3 font-medium bg-white focus:ring-0 outline-none"
                    placeholder="Misal: Bukti pembayaran buram / salah upload"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-3 border-4 border-black font-headline-md uppercase text-sm hover:bg-zinc-100"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submitReject}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-error text-white border-4 border-black font-headline-md uppercase text-sm hover:bg-error/90"
                  >
                    {isProcessing ? 'Proses...' : 'Kirim Penolakan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Rekam Bayar Offline */}
        {showRekamModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-lg neubrutal-shadow">
              <div className="p-4 border-b-4 border-black bg-primary text-white flex justify-between items-center">
                <h2 className="font-display-bold text-lg uppercase">Rekam Bayar Offline (Tunai)</h2>
                <button onClick={() => setShowRekamModal(false)} className="hover:text-black transition-colors">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <form onSubmit={handleRekamBayar} className="p-6 space-y-4">
                {/* Cari Warga */}
                <div className="relative" ref={wargaDropdownRef}>
                  <label className="block font-label-bold uppercase text-xs mb-2">Cari & Pilih Warga (KK)</label>
                  <input
                    type="text"
                    placeholder="Ketik nama warga atau nomor KK..."
                    value={wargaSearch}
                    onChange={(e) => {
                      setWargaSearch(e.target.value)
                      setShowWargaDropdown(true)
                    }}
                    onFocus={() => setShowWargaDropdown(true)}
                    className="w-full border-4 border-black p-3 font-bold bg-white text-sm"
                  />
                  {showWargaDropdown && (
                    <div className="absolute z-50 left-0 right-0 max-h-48 overflow-y-auto border-4 border-black bg-white divide-y-2 divide-black/10 mt-1 shadow-lg">
                      {wargaList
                        .filter(w => 
                          w.user?.nama.toLowerCase().includes(wargaSearch.toLowerCase()) ||
                          w.user?.nomorKK.includes(wargaSearch)
                        )
                        .map(w => (
                          <div
                            key={w.id}
                            onClick={() => {
                              setRekamData(prev => ({ ...prev, wargaId: w.id }))
                              setWargaSearch(`${w.user?.nama} (${w.user?.nomorKK})`)
                              setShowWargaDropdown(false)
                            }}
                            className="p-3 text-xs font-bold hover:bg-zinc-100 cursor-pointer"
                          >
                            {w.user?.nama} - KK: {w.user?.nomorKK}
                          </div>
                        ))}
                    </div>
                  )}
                  {rekamData.wargaId && (
                    <p className="text-[11px] text-green-600 font-bold mt-1 uppercase">✓ Terpilih: {selectedWargaLabel}</p>
                  )}
                </div>

                {/* Pilih Tipe Iuran */}
                <div>
                  <label className="block font-label-bold uppercase text-xs mb-2">Tipe Iuran</label>
                  <select
                    className="w-full border-4 border-black p-3 font-bold bg-white text-sm"
                    value={rekamData.tipe}
                    onChange={(e) => setRekamData(prev => ({ ...prev, tipe: e.target.value }))}
                  >
                    <option value="semua">Iuran Warga + Iuran Makam Sekaligus</option>
                    <option value="warga">Iuran Warga Bulanan Saja</option>
                    <option value="makam">Iuran Makam Saja</option>
                  </select>
                </div>

                {/* Detail Iuran Warga */}
                {(rekamData.tipe === 'warga' || rekamData.tipe === 'semua') && (
                  <div className="p-4 border-2 border-black bg-secondary-container/20 space-y-3">
                    <p className="font-display-bold text-xs uppercase text-zinc-500">Iuran Warga Bulanan (Rp 10.000 / KK)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-label-bold uppercase text-[9px] mb-1">Bulan</label>
                        <select
                          className="w-full border-2 border-black p-2 font-bold text-xs bg-white"
                          value={rekamData.bulanWarga}
                          onChange={(e) => setRekamData(prev => ({ ...prev, bulanWarga: parseInt(e.target.value) }))}
                        >
                          {[...Array(12)].map((_, i) => (
                            <option key={i+1} value={i+1}>{getBulanName(i+1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-label-bold uppercase text-[9px] mb-1">Tahun</label>
                        <select
                          className="w-full border-2 border-black p-2 font-bold text-xs bg-white"
                          value={rekamData.tahunWarga}
                          onChange={(e) => setRekamData(prev => ({ ...prev, tahunWarga: parseInt(e.target.value) }))}
                        >
                          {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detail Iuran Makam */}
                {(rekamData.tipe === 'makam' || rekamData.tipe === 'semua') && (
                  <div className="p-4 border-2 border-black bg-tertiary-fixed/20 space-y-3">
                    <p className="font-display-bold text-xs uppercase text-zinc-500">Iuran Makam (Rp 10.000 / Orang / Bulan)</p>
                    <div>
                      <label className="block font-label-bold uppercase text-[9px] mb-1">Jumlah Bulan yang Ingin Dibayar</label>
                      <input
                        type="number"
                        min="1"
                        max="36"
                        className="w-full border-2 border-black p-2 font-bold text-xs bg-white"
                        value={rekamData.jumlahBulanMakam}
                        onChange={(e) => setRekamData(prev => ({ ...prev, jumlahBulanMakam: Math.max(1, parseInt(e.target.value) || 1) }))}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRekamModal(false)}
                    className="flex-1 py-3 border-4 border-black font-headline-md uppercase text-sm hover:bg-zinc-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-primary text-white border-4 border-black font-headline-md uppercase text-sm neubrutal-shadow active-press disabled:opacity-50"
                  >
                    {isProcessing ? 'Menyimpan...' : 'Simpan Pembayaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Pembayaran Offline */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow">
              <div className="p-4 border-b-4 border-black bg-error text-white flex justify-between items-center">
                <h2 className="font-display-bold text-lg uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined">delete_forever</span>
                  Hapus Pembayaran Offline
                </h2>
                <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }} className="hover:text-black transition-colors">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-error/5 border-2 border-error/20 p-4 space-y-2">
                  <p className="font-bold text-sm text-error uppercase">⚠ Perhatian: Data yang dihapus tidak bisa dikembalikan!</p>
                  <p className="text-xs text-zinc-600">Anda yakin ingin menghapus pembayaran offline berikut?</p>
                </div>
                <div className="bg-zinc-50 border-2 border-black p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-zinc-500 uppercase">Nama Warga</span>
                    <span className="font-bold">{deleteTarget.warga?.user?.nama}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-zinc-500 uppercase">Tipe</span>
                    <span className="font-bold uppercase">{deleteTarget.tipe === 'warga' ? 'Iuran Warga' : 'Iuran Makam'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-zinc-500 uppercase">Detail</span>
                    <span className="font-bold">
                      {deleteTarget.tipe === 'warga' 
                        ? `${getBulanName(deleteTarget.bulan)} ${deleteTarget.tahun}` 
                        : `${deleteTarget.jumlahBulan} Bulan (${deleteTarget.jumlahOrang} Orang)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-black/10 pt-2 mt-2">
                    <span className="font-bold text-zinc-500 uppercase">Jumlah</span>
                    <span className="font-display-bold text-error">{formatRp(deleteTarget.jumlah)}</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
                    className="flex-1 py-3 border-4 border-black font-headline-md uppercase text-sm hover:bg-zinc-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDeleteOffline}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-error text-white border-4 border-black font-headline-md uppercase text-sm neubrutal-shadow active-press disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                    {isProcessing ? 'Menghapus...' : 'Hapus Permanen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Pilih Bulan & Tahun Export Excel */}
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow">
              <div className="p-4 border-b-4 border-black bg-[#ffae19] text-black flex justify-between items-center">
                <h2 className="font-display-bold text-lg uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined">download</span>
                  Export Laporan Bulanan
                </h2>
                <button onClick={() => setShowExportModal(false)} className="hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-2xl font-bold">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs font-bold text-zinc-600 uppercase">
                  Pilih bulan dan tahun pembayaran lunas untuk diekspor ke format Excel.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-label-bold uppercase text-[10px] mb-1">Bulan</label>
                    <select
                      className="w-full border-4 border-black p-3 font-bold text-sm bg-white"
                      value={exportBulan}
                      onChange={(e) => setExportBulan(parseInt(e.target.value))}
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i+1} value={i+1}>{getBulanName(i+1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase text-[10px] mb-1">Tahun</label>
                    <select
                      className="w-full border-4 border-black p-3 font-bold text-sm bg-white"
                      value={exportTahun}
                      onChange={(e) => setExportTahun(parseInt(e.target.value))}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t-2 border-black/10">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 py-3 border-4 border-black font-headline-md uppercase text-sm hover:bg-zinc-100"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => handleExportExcel(exportBulan, exportTahun)}
                    className="flex-1 py-3 bg-[#ffae19] text-black border-4 border-black font-headline-md uppercase text-sm neubrutal-shadow active-press"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
