import { useState, useRef, useEffect } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const filterOptions = ['Semua', 'Iuran Makam']

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function WargaKuitansi() {
  const [kuitansiData, setKuitansiData] = useState([])
  const [selectedKuitansi, setSelectedKuitansi] = useState(null)
  const [filter, setFilter] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const printRef = useRef(null)

  useEffect(() => {
    const fetchKuitansi = async () => {
      try {
        setLoading(true)
        const res = await api.get('/iuran')
        const lunas = res.data.filter((item) => item.status === 'lunas')
        
        // Grouping logic
        const grouped = {}
        lunas.forEach(item => {
          const key = item.transaksiId || `NON-${item.id}`
          if (!grouped[key]) {
            grouped[key] = {
              ...item,
              nominal: 0,
              bulanList: [],
              isGrouped: !!item.transaksiId
            }
          }
          grouped[key].nominal += Number(item.jumlah)
          grouped[key].bulanList.push({ bulan: item.bulan, tahun: item.tahun })
        })

        const formatted = Object.values(grouped).map(item => {
          // Sort bulanList
          item.bulanList.sort((a, b) => (a.tahun - b.tahun) || (a.bulan - b.bulan))
          
          let periodeStr = `${getBulanName(item.bulanList[0].bulan)} ${item.bulanList[0].tahun}`
          if (item.bulanList.length > 1) {
            const last = item.bulanList[item.bulanList.length - 1]
            periodeStr += ` - ${getBulanName(last.bulan)} ${last.tahun}`
          }

          return {
            id: item.transaksiId || `KWT-${item.tahun}-${String(item.bulan).padStart(2, '0')}-${item.id}`,
            invoiceId: item.transaksiId || `INV-${item.id}`,
            jenis: 'Iuran Makam',
            bulan: periodeStr,
            nominal: item.nominal,
            metode: item.metode || 'Transfer',
            noRef: item.transaksiId || `REF-${item.id}-${Math.floor(Math.random() * 10000)}`,
            tanggalBayar: item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-',
            tanggalVerifikasi: item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-',
            diverifikasiOleh: 'Admin RT',
            status: 'lunas',
            icon: 'deceased',
            isMultiMonth: item.bulanList.length > 1,
            namaWarga: item.warga?.user?.nama || 'Warga'
          }
        })
        
        setKuitansiData(formatted.reverse())
      } catch (error) {
        console.error('Failed to fetch kuitansi:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchKuitansi()
  }, [])

  const totalBayar = kuitansiData.reduce((sum, k) => sum + k.nominal, 0)

  const filteredData = kuitansiData.filter((k) => {
    const matchFilter =
      filter === 'Semua' ||
      (filter === 'Iuran Makam' && k.jenis.includes('Iuran Makam'))

    const matchSearch =
      searchQuery === '' ||
      k.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.jenis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.bulan.toLowerCase().includes(searchQuery.toLowerCase())

    return matchFilter && matchSearch
  })

  const handlePrint = (kuitansi) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kuitansi ${kuitansi.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 40px; color: #1a1c1c; }
          .receipt { border: 4px solid #000; max-width: 600px; margin: 0 auto; }
          .receipt-header { background: #6b38d4; color: white; padding: 24px; text-align: center; border-bottom: 4px solid #000; }
          .receipt-header h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
          .receipt-header p { font-size: 12px; margin-top: 4px; opacity: 0.9; text-transform: uppercase; font-weight: 700; }
          .receipt-id { background: #f3f3f4; padding: 16px 24px; border-bottom: 4px solid #000; display: flex; justify-content: space-between; align-items: center; }
          .receipt-id .id { font-size: 18px; font-weight: 900; }
          .receipt-id .status { background: #006b5f; color: white; padding: 4px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 2px solid #000; }
          .receipt-body { padding: 24px; }
          .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 2px dashed #cbc3d7; }
          .receipt-row:last-child { border-bottom: none; }
          .receipt-row .label { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #7b7486; }
          .receipt-row .value { font-size: 14px; font-weight: 700; text-align: right; }
          .receipt-total { background: #ffe083; padding: 20px 24px; border-top: 4px solid #000; display: flex; justify-content: space-between; align-items: center; }
          .receipt-total .label { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .receipt-total .amount { font-size: 28px; font-weight: 900; }
          .receipt-footer { background: #f9f9f9; padding: 16px 24px; border-top: 4px solid #000; text-align: center; }
          .receipt-footer p { font-size: 11px; color: #7b7486; font-weight: 600; }
          .receipt-stamp { text-align: center; padding: 16px; }
          .receipt-stamp .check { font-size: 48px; color: #006b5f; }
          @media print { body { padding: 0; } .receipt { border-width: 2px; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="receipt-header">
            <h1>IURAN MAKAM RT 03</h1>
            <p>Kuitansi Pembayaran Iuran Warga RT 03</p>
          </div>
          <div class="receipt-id">
            <span class="id">${kuitansi.id}</span>
            <span class="status">✓ LUNAS</span>
          </div>
          <div class="receipt-body">
            <div class="receipt-row">
              <span class="label">Nama Warga</span>
              <span class="value">${kuitansi.namaWarga}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Jenis Iuran</span>
              <span class="value">${kuitansi.jenis}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Periode</span>
              <span class="value">${kuitansi.bulan}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Metode Bayar</span>
              <span class="value">${kuitansi.metode}</span>
            </div>
            <div class="receipt-row">
              <span class="label">No. Referensi</span>
              <span class="value">${kuitansi.noRef}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Tanggal Bayar</span>
              <span class="value">${kuitansi.tanggalBayar}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Diverifikasi Oleh</span>
              <span class="value">${kuitansi.diverifikasiOleh}</span>
            </div>
          </div>
          <div class="receipt-total">
            <span class="label">Total Dibayar</span>
            <span class="amount">${formatRp(kuitansi.nominal)}</span>
          </div>
          <div class="receipt-stamp">
            <div class="check">✓</div>
            <p style="font-weight:800; text-transform:uppercase; font-size:12px; color:#006b5f;">Pembayaran Terverifikasi</p>
          </div>
          <div class="receipt-footer">
            <p>Kuitansi ini dicetak secara digital dan sah tanpa tanda tangan.</p>
            <p style="margin-top:4px;">Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <WargaLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header */}
        <div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
              Kuitansi Saya
            </h1>
            <p className="font-body-lg text-zinc-600">
              Riwayat pembayaran & bukti kuitansi iuran.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white border-4 border-black px-4 py-3 neubrutal-shadow">
              <p className="font-label-bold uppercase text-[10px] text-zinc-500">Total Dibayar</p>
              <p className="font-headline-md uppercase">{formatRp(totalBayar)}</p>
            </div>
            <div className="bg-secondary-container border-4 border-black px-4 py-3 neubrutal-shadow">
              <p className="font-label-bold uppercase text-[10px] text-zinc-500">Transaksi</p>
              <p className="font-headline-md uppercase">{kuitansiData.length}x</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border-4 border-black neubrutal-shadow-lg p-4 mb-4 md:mb-gutter">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* Search */}
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                search
              </span>
              <input
                type="text"
                placeholder="Cari no. kuitansi, jenis iuran, periode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-4 border-black pl-10 pr-4 py-3 font-bold text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`px-3 py-2 border-2 border-black font-label-bold text-[11px] uppercase transition-all active:translate-y-0.5 active:shadow-none ${
                    filter === opt
                      ? 'bg-primary text-white neubrutal-shadow'
                      : 'bg-white hover:bg-tertiary-fixed'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-gutter">
          {/* Receipt List */}
          <div className="md:col-span-7 lg:col-span-8 space-y-3 md:space-y-4">
            {loading ? (
              <p className="text-center text-zinc-500 py-4 font-bold uppercase text-xs">Memuat kuitansi...</p>
            ) : filteredData.length === 0 ? (
              <div className="bg-white border-4 border-black p-8 md:p-12 neubrutal-shadow text-center">
                <span className="material-symbols-outlined text-6xl text-zinc-300 mb-4 block">
                  search_off
                </span>
                <p className="font-headline-md uppercase text-zinc-400">Tidak ada kuitansi</p>
                <p className="text-sm text-zinc-400 mt-2">
                  Coba ubah filter atau kata kunci pencarian.
                </p>
              </div>
            ) : (
              filteredData.map((k, idx) => (
                <div
                  key={k.id}
                  onClick={() => setSelectedKuitansi(k)}
                  className={`bg-white border-4 border-black neubrutal-shadow cursor-pointer transition-all hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group ${
                    selectedKuitansi?.id === k.id ? 'ring-4 ring-primary ring-offset-2' : ''
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="p-4 flex items-start gap-3 md:gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-tertiary-fixed border-2 border-black flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined">{k.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-headline-md text-sm md:text-base leading-tight truncate">
                            {k.jenis}
                          </p>
                          <p className="font-label-bold uppercase text-[10px] text-zinc-500 mt-0.5">
                            {k.id} • {k.bulan}
                          </p>
                        </div>
                        <p className="font-display-bold text-base md:text-lg whitespace-nowrap">
                          {formatRp(k.nominal)}
                        </p>
                      </div>

                      {/* Bottom Info */}
                      <div className="mt-3 pt-3 border-t-2 border-dashed border-zinc-300 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-secondary text-white px-2 py-0.5 border-2 border-black text-[10px] font-label-bold uppercase">
                            ✓ Lunas
                          </span>
                          <span className="text-[11px] text-zinc-500 font-bold">
                            {k.tanggalBayar}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-zinc-400 font-bold uppercase">
                            {k.metode}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Pagination indicator */}
            {filteredData.length > 0 && (
              <div className="flex justify-center pt-2 pb-20 md:pb-4">
                <p className="text-xs text-zinc-400 font-bold uppercase">
                  Menampilkan {filteredData.length} dari {kuitansiData.length} kuitansi
                </p>
              </div>
            )}
          </div>

          {/* Receipt Detail / Preview Sidebar */}
          <div className="md:col-span-5 lg:col-span-4 mb-24 md:mb-0">
            <div className="md:sticky md:top-28 space-y-4">
              {selectedKuitansi ? (
                <>
                  {/* Receipt Preview Card */}
                  <div
                    ref={printRef}
                    className="bg-white border-4 border-black neubrutal-shadow-lg overflow-hidden"
                  >
                    {/* Receipt Header */}
                    <div className="bg-primary text-white p-4 border-b-4 border-black text-center">
                      <h2 className="font-display-bold text-xl md:text-2xl uppercase tracking-tight">
                        IURAN MAKAM RT 03
                      </h2>
                      <p className="text-[10px] font-label-bold uppercase opacity-80 mt-1">
                        Kuitansi Pembayaran Iuran Warga RT 03
                      </p>
                    </div>

                    {/* ID & Status */}
                    <div className="bg-zinc-100 border-b-4 border-black p-3 flex justify-between items-center">
                      <span className="font-headline-md text-sm">{selectedKuitansi.id}</span>
                      <span className="bg-secondary text-white px-2 py-0.5 border-2 border-black text-[10px] font-label-bold uppercase">
                        ✓ Lunas
                      </span>
                    </div>

                    {/* Receipt Body */}
                    <div className="p-4 space-y-0">
                      {[
                        { label: 'Nama Warga', value: selectedKuitansi.namaWarga },
                        { label: 'Jenis', value: selectedKuitansi.jenis },
                        { label: 'Periode', value: selectedKuitansi.bulan },
                        { label: 'Metode', value: selectedKuitansi.metode },
                        { label: 'No. Ref', value: selectedKuitansi.noRef },
                        { label: 'Tgl. Bayar', value: selectedKuitansi.tanggalBayar },
                        { label: 'Verifikasi', value: selectedKuitansi.diverifikasiOleh },
                      ].map((row, i) => (
                        <div
                          key={row.label}
                          className={`flex justify-between py-2.5 ${
                            i !== 6 ? 'border-b border-dashed border-zinc-300' : ''
                          }`}
                        >
                          <span className="text-[11px] uppercase font-label-bold text-zinc-500">
                            {row.label}
                          </span>
                          <span className="text-xs font-bold text-right ml-2">{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="bg-tertiary-fixed border-t-4 border-black p-4 flex justify-between items-center">
                      <span className="font-label-bold uppercase text-xs">Total Dibayar</span>
                      <span className="font-display-bold text-xl md:text-2xl">
                        {formatRp(selectedKuitansi.nominal)}
                      </span>
                    </div>

                    {/* Verified Stamp */}
                    <div className="p-4 text-center border-t-4 border-black bg-white">
                      <div className="inline-flex items-center gap-2 px-4 py-2 border-4 border-secondary text-secondary rotate-[-2deg]">
                        <span className="material-symbols-outlined text-2xl">verified</span>
                        <span className="font-label-bold uppercase text-xs">Terverifikasi</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => handlePrint(selectedKuitansi)}
                      className="w-full bg-primary text-white border-4 border-black p-3 font-headline-md uppercase text-sm neubrutal-shadow active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined">print</span>
                      Cetak Kuitansi
                    </button>
                  </div>
                </>
              ) : (
                /* Empty state when no receipt selected */
                <div className="bg-white border-4 border-black neubrutal-shadow-lg p-8 md:p-12 text-center">
                  <div className="w-20 h-20 mx-auto bg-tertiary-fixed border-4 border-black flex items-center justify-center mb-4 neubrutal-shadow">
                    <span className="material-symbols-outlined text-4xl">receipt_long</span>
                  </div>
                  <h3 className="font-headline-md uppercase text-sm mb-2">Pilih Kuitansi</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Klik salah satu kuitansi di sebelah kiri untuk melihat detail dan mencetak bukti
                    pembayaran.
                  </p>
                </div>
              )}

              {/* Summary Stats Card */}
              <div className="bg-zinc-100 border-4 border-black p-4 neubrutal-shadow">
                <h4 className="font-headline-md uppercase text-xs mb-3 pb-2 border-b-2 border-black">
                  Ringkasan Pembayaran
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600 font-bold">Iuran Makam</span>
                    <span className="font-bold">
                      {formatRp(
                        kuitansiData
                          .filter((k) => k.jenis.includes('Iuran Makam'))
                          .reduce((s, k) => s + k.nominal, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t-2 border-black">
                    <span className="font-label-bold uppercase">Grand Total</span>
                    <span className="font-headline-md text-base">{formatRp(totalBayar)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WargaLayout>
  )
}
