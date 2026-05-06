import { useState, useEffect } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function WargaRiwayat() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true)
        const res = await api.get('/iuran')
        // Tampilkan semua iuran
        setHistory(res.data.reverse())
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  const getStatusBadge = (status, note) => {
    if (status === 'lunas') {
      return (
        <span className="bg-secondary text-white px-2 py-0.5 border-2 border-black text-[10px] font-label-bold uppercase">
          ✓ Lunas
        </span>
      )
    }
    if (status === 'pending') {
      return (
        <span className="bg-tertiary-fixed text-black px-2 py-0.5 border-2 border-black text-[10px] font-label-bold uppercase">
          ⌛ Menunggu
        </span>
      )
    }
    if (status === 'belum_bayar' && note) {
      return (
        <span className="bg-error text-white px-2 py-0.5 border-2 border-black text-[10px] font-label-bold uppercase">
          ✕ Ditolak
        </span>
      )
    }
    return (
      <span className="bg-zinc-200 text-zinc-500 px-2 py-0.5 border-2 border-zinc-400 text-[10px] font-label-bold uppercase">
        ○ Belum Bayar
      </span>
    )
  }

  return (
    <WargaLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-lg">
          <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
            Riwayat Pembayaran
          </h1>
          <p className="font-body-lg text-zinc-600">
            Pantau status verifikasi pembayaran iuran Anda.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white border-4 border-black p-12 text-center neubrutal-shadow">
            <span className="material-symbols-outlined text-6xl text-zinc-200 mb-4">history</span>
            <p className="font-headline-md uppercase text-zinc-400">Belum ada riwayat</p>
            <p className="text-sm text-zinc-400 mt-2">Semua aktivitas pembayaran Anda akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-white border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 border-2 border-black flex items-center justify-center shrink-0 ${
                    item.status === 'lunas' ? 'bg-secondary text-white' : 
                    item.status === 'pending' ? 'bg-tertiary-fixed text-black' : 
                    (item.status === 'belum_bayar' && item.catatanAdmin) ? 'bg-error text-white' : 'bg-zinc-100 text-zinc-400'
                  }`}>
                    <span className="material-symbols-outlined">
                      {item.status === 'lunas' ? 'check_circle' : 
                       item.status === 'pending' ? 'hourglass_empty' : 
                       (item.status === 'belum_bayar' && item.catatanAdmin) ? 'cancel' : 'radio_button_unchecked'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-sm md:text-base uppercase leading-tight">
                      Iuran Makam {getBulanName(item.bulan)} {item.tahun}
                    </h3>
                    <p className="font-label-bold uppercase text-[10px] text-zinc-500 mt-1">
                      {item.metode || 'Metode Belum Tersedia'} • {formatRp(item.jumlah)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status, item.catatanAdmin)}
                    <span className="text-[11px] font-bold text-zinc-400 uppercase">
                      {item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-'}
                    </span>
                  </div>
                  {item.catatanAdmin && (
                    <div className={`text-xs p-2 border-2 border-black font-bold max-w-xs ${
                      item.status === 'lunas' ? 'bg-zinc-50' : 'bg-error/10 text-error'
                    }`}>
                      <span className="uppercase text-[9px] block text-zinc-400 mb-1">Catatan Admin:</span>
                      {item.catatanAdmin}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-tertiary-fixed border-4 border-black p-4 neubrutal-shadow flex items-start gap-3">
          <span className="material-symbols-outlined">info</span>
          <p className="text-xs leading-relaxed">
            Jika pembayaran Anda ditolak, silakan cek <strong>Catatan Admin</strong> di atas untuk mengetahui alasannya dan lakukan pembayaran ulang melalui menu Tagihan dengan bukti transfer yang benar.
          </p>
        </div>
      </div>
    </WargaLayout>
  )
}
