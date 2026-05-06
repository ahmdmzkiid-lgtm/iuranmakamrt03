import { useState, useEffect } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function WargaTagihan() {
  const [tagihanAktif, setTagihanAktif] = useState([])
  const [profil, setProfil] = useState(null)
  const [selected, setSelected] = useState([])
  const [metode, setMetode] = useState('transfer')
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jumlahBulanAwal, setJumlahBulanAwal] = useState(1)
  const [buktiFile, setBuktiFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [paymentSettings, setPaymentSettings] = useState(null)
  const { showAlert } = useNotification()

  const fetchTagihan = async () => {
    try {
      setLoading(true)
      const [resIuran, resProfil, resSettings] = await Promise.all([
        api.get('/iuran'),
        api.get('/warga/me'),
        api.get('/settings')
      ])
      
      setProfil(resProfil.data)
      setPaymentSettings(resSettings.data)
      
      // Hanya ambil yang belum dibayar
      const belumBayar = resIuran.data.filter((item) => item.status === 'belum_bayar')
      
      const formatted = belumBayar.map((item) => ({
        id: item.id,
        jenis: `Iuran Makam ${getBulanName(item.bulan)} ${item.tahun}`,
        kategori: 'Iuran Makam',
        nominal: Number(item.jumlah),
        jatuhTempo: `10 ${getBulanName(item.bulan).substring(0, 3)} ${item.tahun}`,
        status: item.status,
        icon: 'deceased',
        color: 'bg-white', // default color
      }))
      
      setTagihanAktif(formatted)
      setSelected(formatted.map((t) => t.id))
    } catch (error) {
      console.error('Failed to fetch tagihan:', error)
      showAlert('Gagal mengambil data tagihan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTagihan()
  }, [])

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const totalBayarAktif = tagihanAktif
    .filter((t) => selected.includes(t.id))
    .reduce((sum, t) => sum + t.nominal, 0)

  const isBayarAwal = tagihanAktif.length === 0
  const jumlahMakam = profil?.jumlahMakam || 1
  const sisaBulan = profil ? Math.max(0, 35 - profil.bulanTerbayar) : 35
  const totalBayarAwal = jumlahBulanAwal * jumlahMakam * 10000

  const total = isBayarAwal ? totalBayarAwal : totalBayarAktif

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setBuktiFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleBayar = async () => {
    if (!isBayarAwal && selected.length === 0) return
    
    if (metode !== 'tunai' && !buktiFile) {
      showAlert('Mohon unggah bukti pembayaran terlebih dahulu!')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      let namaMetode = ''
      if (metode === 'tunai') {
        namaMetode = 'Bayar Tunai'
      } else if (metode === 'qris') {
        namaMetode = 'Transfer QRIS'
      } else {
        namaMetode = `Transfer ${paymentSettings?.bank_name || 'Bank'}`
      }
      formData.append('metode', namaMetode)
      if (buktiFile) {
        formData.append('buktiBayar', buktiFile)
      }

      if (isBayarAwal) {
        formData.append('jumlahBulan', jumlahBulanAwal)
        await api.post('/iuran/bayar-awal', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } else {
        formData.append('iuranIds', JSON.stringify(selected))
        await api.post('/iuran/bayar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }
      await showAlert('Pembayaran berhasil dikirim dan menunggu verifikasi!')
      setBuktiFile(null)
      setPreviewUrl(null)
      fetchTagihan() // refresh data
    } catch (error) {
      console.error('Gagal bayar:', error)
      showAlert(error.response?.data?.message || 'Gagal melakukan pembayaran')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <WargaLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header */}
        <div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
              Tagihan Saya
            </h1>
            <p className="font-body-lg text-zinc-600">
              Daftar tagihan aktif Anda.
            </p>
          </div>
          <div className="bg-white border-4 border-black px-4 py-3 neubrutal-shadow">
            <p className="font-label-bold uppercase text-[10px] text-zinc-500">Total Tagihan</p>
            <p className="font-headline-md uppercase">{tagihanAktif.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-gutter">
          {/* Outstanding Bills */}
          <div className="md:col-span-8 space-y-4 md:space-y-gutter">
            <div className="bg-white border-4 border-black neubrutal-shadow-lg">
              <div className="border-b-4 border-black p-4 bg-zinc-100 flex justify-between items-center">
                <h2 className="font-headline-md uppercase flex items-center gap-2 text-sm md:text-base">
                  <span className="material-symbols-outlined">receipt_long</span>
                  Tagihan Aktif ({tagihanAktif.length})
                </h2>
                <span className="bg-error text-white border-2 border-black px-3 py-1 font-label-bold uppercase text-[10px]">
                  Belum Bayar
                </span>
              </div>

              <div className="p-4 space-y-3">
                {loading ? (
                  <p className="text-center text-zinc-500 py-4 font-bold uppercase text-xs">Memuat tagihan...</p>
                ) : tagihanAktif.length === 0 ? (
                  <p className="text-center text-zinc-500 py-4 font-bold uppercase text-xs">Tidak ada tagihan aktif.</p>
                ) : (
                  tagihanAktif.map((t) => {
                    const checked = selected.includes(t.id)
                    return (
                      <label
                        key={t.id}
                        className={`block border-4 border-black p-4 neubrutal-shadow cursor-pointer transition-all ${
                          checked ? 'bg-tertiary-fixed' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3 md:gap-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(t.id)}
                            className="w-5 h-5 border-2 border-black mt-1 shrink-0 accent-black"
                          />
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-2 border-black flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined">{t.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start flex-wrap gap-1">
                              <div className="min-w-0">
                                <p className="font-headline-md text-sm md:text-base leading-tight">
                                  {t.jenis}
                                </p>
                                <p className="font-label-bold uppercase text-[10px] text-zinc-600 mt-0.5">
                                  {t.kategori} • {t.id}
                                </p>
                              </div>
                              <p className="font-display-bold text-lg md:text-xl whitespace-nowrap">
                                {formatRp(t.nominal)}
                              </p>
                            </div>
                            <div className="mt-3 pt-3 border-t-2 border-black flex justify-between items-center flex-wrap gap-2">
                              <p className="text-xs font-bold">
                                <span className="uppercase text-zinc-500">Jatuh tempo:</span>{' '}
                                {t.jatuhTempo}
                              </p>
                              <button className="bg-white border-2 border-black px-3 py-1 font-label-bold uppercase text-[10px] hover:bg-tertiary-fixed transition-colors">
                                Detail
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            {/* Bayar di Awal Section */}
            {tagihanAktif.length === 0 && !loading && sisaBulan > 0 && (
              <div className="bg-white border-4 border-black neubrutal-shadow-lg">
                <div className="border-b-4 border-black p-4 bg-tertiary-fixed flex justify-between items-center">
                  <h2 className="font-headline-md uppercase flex items-center gap-2 text-sm md:text-base">
                    <span className="material-symbols-outlined">event_upcoming</span>
                    Bayar Iuran Lebih Awal
                  </h2>
                </div>
                <div className="p-4 md:p-md">
                  <p className="font-body-md text-sm mb-4">
                    Anda tidak memiliki tagihan aktif. Namun, Anda dapat membayar iuran untuk bulan-bulan berikutnya di awal (Maksimal sisa {sisaBulan} bulan).
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block font-label-bold uppercase mb-2 text-xs">Jumlah Bulan</label>
                      <input 
                        type="number" 
                        min="1" 
                        max={sisaBulan} 
                        value={jumlahBulanAwal} 
                        onChange={(e) => setJumlahBulanAwal(Math.min(sisaBulan, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-tertiary-fixed focus:outline-none transition-colors" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block font-label-bold uppercase mb-2 text-xs">Total (Berdasarkan {jumlahMakam} Makam)</label>
                      <p className="font-display-bold text-xl md:text-2xl pt-2">{formatRp(totalBayarAwal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {tagihanAktif.length === 0 && !loading && sisaBulan === 0 && (
              <div className="bg-secondary-container border-4 border-black p-4 md:p-md neubrutal-shadow-lg flex items-center gap-4">
                <span className="material-symbols-outlined text-4xl text-secondary">verified</span>
                <div>
                  <h2 className="font-headline-md uppercase text-secondary">Pelunasan Selesai</h2>
                  <p className="font-body-md text-sm text-secondary-dim">Anda telah melunasi seluruh iuran 35 bulan.</p>
                </div>
              </div>
            )}

            {/* Info Card */}
            <div className="bg-primary-fixed border-4 border-black p-4 md:p-md neubrutal-shadow flex items-start gap-3 md:gap-4">
              <div className="bg-white border-2 border-black p-2 shrink-0">
                <span className="material-symbols-outlined">info</span>
              </div>
              <div>
                <h4 className="font-headline-md uppercase text-sm md:text-base mb-1">
                  Konfirmasi Pembayaran
                </h4>
                <p className="text-xs md:text-sm">
                  Setelah menekan <strong>Bayar Sekarang</strong>, tagihan Anda akan berstatus pending.
                  Bendahara akan memverifikasi dalam 1x24 jam.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Summary Sidebar */}
          <div className="md:col-span-4 mb-24 md:mb-0">
            <div className="md:sticky md:top-28 space-y-gutter">
              <div className="bg-secondary-container border-4 border-black p-4 md:p-md neubrutal-shadow-lg">
                <h3 className="font-headline-md uppercase border-b-4 border-black pb-3 mb-4">
                  Ringkasan Bayar
                </h3>

                <div className="space-y-2 mb-4">
                  {!isBayarAwal ? (
                    <>
                      {tagihanAktif
                        .filter((t) => selected.includes(t.id))
                        .map((t) => (
                          <div key={t.id} className="flex justify-between text-sm">
                            <span className="truncate pr-2">{t.jenis}</span>
                            <span className="font-bold whitespace-nowrap">{formatRp(t.nominal)}</span>
                          </div>
                        ))}
                      {selected.length === 0 && (
                        <p className="text-sm italic text-zinc-600">Belum ada tagihan dipilih.</p>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="truncate pr-2">Pembayaran Awal ({jumlahBulanAwal} bulan)</span>
                      <span className="font-bold whitespace-nowrap">{formatRp(totalBayarAwal)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t-4 border-black pt-3 flex justify-between items-center">
                  <span className="font-label-bold uppercase text-xs">Total</span>
                  <span className="font-display-bold text-2xl md:text-3xl">{formatRp(total)}</span>
                </div>

                {/* Metode Pembayaran */}
                <div className="mt-4 pt-4 border-t-4 border-black">
                  <p className="font-label-bold uppercase text-xs mb-3">Metode Pembayaran</p>
                  <div className="space-y-2">
                    {/* Transfer Bank */}
                    <label
                      className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer transition-colors ${
                        metode === 'transfer' ? 'bg-black text-white' : 'bg-white text-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="metode"
                        value="transfer"
                        checked={metode === 'transfer'}
                        onChange={() => setMetode('transfer')}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="material-symbols-outlined text-sm md:text-base">account_balance</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[10px] md:text-xs uppercase truncate">Transfer {paymentSettings?.bank_name || 'Bank'}</p>
                        <p className="text-[9px] md:text-[10px] opacity-70 truncate">
                          {paymentSettings?.bank_account || '...'}
                        </p>
                      </div>
                    </label>

                    {/* QRIS */}
                    <label
                      className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer transition-colors ${
                        metode === 'qris' ? 'bg-black text-white' : 'bg-white text-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="metode"
                        value="qris"
                        checked={metode === 'qris'}
                        onChange={() => setMetode('qris')}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="material-symbols-outlined text-sm md:text-base">qr_code_2</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[10px] md:text-xs uppercase truncate">Transfer QRIS</p>
                        <p className="text-[9px] md:text-[10px] opacity-70 truncate">Otomatis / E-Wallet</p>
                      </div>
                    </label>

                    {/* Tunai */}
                    <label
                      className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer transition-colors ${
                        metode === 'tunai' ? 'bg-black text-white' : 'bg-white text-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="metode"
                        value="tunai"
                        checked={metode === 'tunai'}
                        onChange={() => setMetode('tunai')}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="material-symbols-outlined">payments</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase">Bayar Tunai</p>
                        <p className="text-[10px] opacity-70 truncate">Langsung ke Bendahara RT</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* QRIS Display if selected and exists */}
                {metode === 'qris' && paymentSettings?.qris_url && (
                  <div className="mt-4 pt-4 border-t-4 border-black text-center animate-in fade-in zoom-in duration-300">
                    <p className="font-label-bold uppercase text-[10px] mb-2">Scan QRIS untuk Bayar</p>
                    <div className="bg-white border-2 border-black p-2 inline-block neubrutal-shadow">
                      <img 
                        src={paymentSettings.qris_url.startsWith('http') ? paymentSettings.qris_url : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${paymentSettings.qris_url}`} 
                        alt="QRIS" 
                        className="w-40 h-40 object-contain mx-auto"
                      />
                    </div>
                  </div>
                )}

                {/* Upload Bukti Pembayaran */}
                {metode !== 'tunai' && (
                  <div className="mt-4 pt-4 border-t-4 border-black">
                    <p className="font-label-bold uppercase text-xs mb-3 flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      Upload Bukti Transfer
                    </p>
                    <div className="space-y-3">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="hidden" 
                        id="bukti-pembayaran"
                      />
                      <label 
                        htmlFor="bukti-pembayaran"
                        className="flex flex-col items-center justify-center border-4 border-dashed border-black p-4 cursor-pointer hover:bg-surface-container transition-colors"
                      >
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="max-h-32 object-contain" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-3xl mb-1">add_a_photo</span>
                            <p className="text-[10px] font-bold uppercase text-center">Klik untuk pilih gambar</p>
                          </>
                        )}
                      </label>
                      {buktiFile && (
                        <p className="text-[10px] font-label-bold text-center truncate">{buktiFile.name}</p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBayar}
                  disabled={(!isBayarAwal && selected.length === 0) || (isBayarAwal && sisaBulan === 0) || isSubmitting}
                  className="w-full mt-6 bg-primary text-white border-4 border-black p-4 font-display-bold uppercase text-sm md:text-base neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0"
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  {isSubmitting ? 'Memproses...' : 'Bayar Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WargaLayout>
  )
}
