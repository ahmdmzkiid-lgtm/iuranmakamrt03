import { useState, useEffect, useMemo } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function WargaTagihan() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState(null)
  const { showAlert } = useNotification()

  // Form states
  const [payType, setPayType] = useState('semua') // 'warga' | 'makam' | 'semua'
  const [jumlahBulanMakam, setJumlahBulanMakam] = useState(1)
  const [bulanWarga, setBulanWarga] = useState(new Date().getMonth() + 1)
  const [tahunWarga, setTahunWarga] = useState(new Date().getFullYear())
  const [metode, setMetode] = useState('transfer') // 'transfer' | 'qris' | 'tunai'
  const [buktiFile, setBuktiFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const [summaryRes, settingsRes] = await Promise.all([
        api.get('/iuran/summary'),
        api.get('/settings')
      ])
      setSummary(summaryRes.data)
      setPaymentSettings(settingsRes.data)
      
      // Auto adjust payType if warga is already lunas for the month
      if (summaryRes.data?.iuranWarga?.sudahBayar && !summaryRes.data?.warga?.makamLunas) {
        setPayType('makam')
      } else if (!summaryRes.data?.iuranWarga?.sudahBayar && summaryRes.data?.warga?.makamLunas) {
        setPayType('warga')
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error)
      showAlert('Gagal mengambil data tagihan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setBuktiFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const billSummary = useMemo(() => {
    if (!summary) return { totalWarga: 0, totalMakam: 0, total: 0 }

    const isWarga = payType === 'warga' || payType === 'semua'
    const isMakam = payType === 'makam' || payType === 'semua'

    const totalWarga = isWarga && !summary.iuranWarga.sudahBayar ? Number(summary.iuranWarga.tarif) : 0
    const totalMakam = isMakam && !summary.warga.makamLunas 
      ? jumlahBulanMakam * summary.warga.jumlahOrang * Number(summary.iuranMakam.tarifPerOrang) 
      : 0

    return {
      totalWarga,
      totalMakam,
      total: totalWarga + totalMakam
    }
  }, [summary, payType, jumlahBulanMakam])

  const handleBayar = async () => {
    if (billSummary.total === 0) {
      return showAlert('Tidak ada nominal iuran yang perlu dibayar')
    }

    if (metode !== 'tunai' && !buktiFile) {
      return showAlert('Mohon unggah bukti transfer pembayaran!')
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

      let endpoint = '/iuran/bayar-semua'
      if (payType === 'warga') {
        endpoint = '/iuran/bayar-warga'
        formData.append('bulan', bulanWarga)
        formData.append('tahun', tahunWarga)
      } else if (payType === 'makam') {
        endpoint = '/iuran/bayar-makam'
        formData.append('jumlahBulan', jumlahBulanMakam)
      } else {
        formData.append('jumlahBulanMakam', jumlahBulanMakam)
        formData.append('bulanWarga', bulanWarga)
        formData.append('tahunWarga', tahunWarga)
      }

      await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      await showAlert('Pembayaran berhasil dikirim dan menunggu verifikasi!')
      setBuktiFile(null)
      setPreviewUrl(null)
      fetchSummary()
    } catch (error) {
      console.error('Gagal bayar:', error)
      showAlert(error.response?.data?.message || 'Gagal melakukan pembayaran')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <WargaLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-bold text-3xl md:text-4xl uppercase leading-none">Pembayaran Iuran</h1>
            <p className="font-body-md text-zinc-600 mt-2">
              Silakan pilih jenis iuran yang ingin dibayarkan secara mandiri atau sekaligus.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="bg-white border-4 border-black p-8 text-center font-display-bold uppercase">
            Memuat data pembayaran...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Pembayaran Form */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Status & Progress Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Iuran Warga Info */}
                <div className="border-4 border-black p-4 bg-zinc-50 flex items-start gap-4">
                  <div className="w-10 h-10 bg-secondary-container border-2 border-black flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">groups</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-xs">Iuran Bulanan Warga</h3>
                    <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase">
                      Bulan {getBulanName(summary?.iuranWarga?.bulanIni)}: {summary?.iuranWarga?.sudahBayar ? 'LUNAS' : 'BELUM BAYAR'}
                    </p>
                  </div>
                </div>

                {/* Iuran Makam Progress */}
                <div className="border-4 border-black p-4 bg-zinc-50 flex items-start gap-4">
                  <div className="w-10 h-10 bg-tertiary-fixed border-2 border-black flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">deceased</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline-md uppercase text-xs">Iuran Makam (36 Bln)</h3>
                    <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase">
                      {summary?.warga?.bulanMakamTerbayar}/36 Bulan Terbayar
                    </p>
                    <p className="text-[9px] font-bold text-error mt-0.5 uppercase">
                      Sisa {summary?.warga?.sisaBulanMakam} bulan wajib bayar
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Input Iuran */}
              <div className="bg-white border-4 border-black p-6 neubrutal-shadow-lg space-y-6">
                <h2 className="font-display-bold text-xl uppercase border-b-4 border-black pb-2">Menu Pembayaran</h2>
                
                {/* 1. Pilih Iuran */}
                <div>
                  <label className="block font-label-bold uppercase text-xs mb-3">Pilih Iuran yang Ingin Dibayar</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={summary?.iuranWarga?.sudahBayar}
                      onClick={() => setPayType('warga')}
                      className={`p-3 border-4 border-black font-headline-md uppercase text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        payType === 'warga' ? 'bg-primary-container text-white' : 'bg-white hover:bg-zinc-50'
                      } ${summary?.iuranWarga?.sudahBayar ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="material-symbols-outlined text-lg">groups</span>
                      Iuran Warga
                    </button>
                    <button
                      type="button"
                      disabled={summary?.warga?.makamLunas}
                      onClick={() => setPayType('makam')}
                      className={`p-3 border-4 border-black font-headline-md uppercase text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        payType === 'makam' ? 'bg-tertiary-fixed text-black' : 'bg-white hover:bg-zinc-50'
                      } ${summary?.warga?.makamLunas ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="material-symbols-outlined text-lg">deceased</span>
                      Iuran Makam
                    </button>
                    <button
                      type="button"
                      disabled={summary?.iuranWarga?.sudahBayar && summary?.warga?.makamLunas}
                      onClick={() => setPayType('semua')}
                      className={`p-3 border-4 border-black font-headline-md uppercase text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        payType === 'semua' ? 'bg-black text-white animate-pulse' : 'bg-white hover:bg-zinc-50'
                      } ${summary?.iuranWarga?.sudahBayar && summary?.warga?.makamLunas ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="material-symbols-outlined text-lg">library_add_check</span>
                      Keduanya
                    </button>
                  </div>
                </div>

                {/* 2. Detail Pembayaran Iuran Warga */}
                {(payType === 'warga' || payType === 'semua') && !summary?.iuranWarga?.sudahBayar && (
                  <div className="border-4 border-black p-4 bg-secondary-container/20 space-y-4">
                    <p className="font-display-bold text-xs uppercase text-zinc-500">Form Iuran Bulanan Warga (Rp 10.000 / KK)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-label-bold uppercase text-[10px] mb-1 text-zinc-500">Bulan</label>
                        <select
                          className="w-full border-2 border-black p-2 text-xs font-bold bg-white"
                          value={bulanWarga}
                          onChange={(e) => setBulanWarga(parseInt(e.target.value))}
                        >
                          {[...Array(12)].map((_, i) => (
                            <option key={i+1} value={i+1}>{getBulanName(i+1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-label-bold uppercase text-[10px] mb-1 text-zinc-500">Tahun</label>
                        <select
                          className="w-full border-2 border-black p-2 text-xs font-bold bg-white"
                          value={tahunWarga}
                          onChange={(e) => setTahunWarga(parseInt(e.target.value))}
                        >
                          {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Detail Pembayaran Iuran Makam */}
                {(payType === 'makam' || payType === 'semua') && !summary?.warga?.makamLunas && (
                  <div className="border-4 border-black p-4 bg-tertiary-fixed/20 space-y-4">
                    <p className="font-display-bold text-xs uppercase text-zinc-500">Form Cicilan Iuran Makam</p>
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <label className="block font-label-bold uppercase text-[10px] text-zinc-500">Pilih Jumlah Bulan yang Ingin Dibayarkan</label>
                        <span className="text-[10px] font-mono font-bold text-zinc-500">Sisa wajib bayar: {summary?.warga?.sisaBulanMakam} Bln</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={summary?.warga?.sisaBulanMakam || 36}
                        className="w-full border-4 border-black p-3 font-bold bg-white text-sm"
                        value={jumlahBulanMakam}
                        onChange={(e) => setJumlahBulanMakam(Math.min(summary?.warga?.sisaBulanMakam || 36, Math.max(1, parseInt(e.target.value) || 1)))}
                      />
                      <p className="text-[10px] font-bold text-zinc-500 mt-2 uppercase">
                        Perhitungan: {jumlahBulanMakam} Bulan × {summary?.warga?.jumlahOrang} Jiwa × {formatRp(summary?.iuranMakam?.tarifPerOrang)} = {formatRp(jumlahBulanMakam * summary?.warga?.jumlahOrang * summary?.iuranMakam?.tarifPerOrang)}
                      </p>
                    </div>
                  </div>
                )}
                
                {billSummary.total === 0 && (
                  <div className="bg-secondary-container border-2 border-black p-4 text-center text-xs font-black uppercase">
                    🎉 Iuran Anda Sudah Lunas! Tidak ada pembayaran aktif yang diperlukan.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Payment Method & Struk Upload */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border-4 border-black p-6 neubrutal-shadow-lg space-y-6">
                <h3 className="font-display-bold text-lg uppercase border-b-4 border-black pb-2">Metode & Konfirmasi</h3>
                
                {/* Settle amount */}
                <div className="bg-zinc-50 border-2 border-black p-3 flex justify-between items-center">
                  <span className="font-label-bold uppercase text-xs text-zinc-500">Total Pembayaran</span>
                  <span className="font-display-bold text-lg text-primary">{formatRp(billSummary.total)}</span>
                </div>

                {/* Radio Button Options */}
                {billSummary.total > 0 && (
                  <div className="space-y-3">
                    <label className="block font-label-bold uppercase text-xs">Pilih Metode Pembayaran</label>
                    
                    <label className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer transition-colors ${metode === 'transfer' ? 'bg-black text-white' : 'bg-white'}`}>
                      <input
                        type="radio"
                        checked={metode === 'transfer'}
                        onChange={() => setMetode('transfer')}
                        className="hidden"
                      />
                      <span className="material-symbols-outlined">account_balance</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase truncate">Transfer Bank</p>
                        <p className="text-[10px] opacity-70 truncate">{paymentSettings?.bank_name}: {paymentSettings?.bank_account}</p>
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer transition-colors ${metode === 'qris' ? 'bg-black text-white' : 'bg-white'}`}>
                      <input
                        type="radio"
                        checked={metode === 'qris'}
                        onChange={() => setMetode('qris')}
                        className="hidden"
                      />
                      <span className="material-symbols-outlined">qr_code_2</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase truncate">Transfer QRIS</p>
                        <p className="text-[10px] opacity-70 truncate">Instan / E-Wallet</p>
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer transition-colors ${metode === 'tunai' ? 'bg-black text-white' : 'bg-white'}`}>
                      <input
                        type="radio"
                        checked={metode === 'tunai'}
                        onChange={() => setMetode('tunai')}
                        className="hidden"
                      />
                      <span className="material-symbols-outlined">payments</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase truncate">Bayar Tunai</p>
                        <p className="text-[10px] opacity-70 truncate">Langsung ke Pengurus RT</p>
                      </div>
                    </label>
                  </div>
                )}

                {/* QRIS Image if selected */}
                {metode === 'qris' && paymentSettings?.qris_url && billSummary.total > 0 && (
                  <div className="border-4 border-black p-3 bg-white text-center">
                    <p className="font-label-bold uppercase text-[9px] mb-2 text-zinc-500">Scan QRIS</p>
                    <img 
                      src={paymentSettings.qris_url} 
                      alt="QRIS" 
                      className="w-32 h-32 object-contain mx-auto" 
                    />
                  </div>
                )}

                {/* Upload Bukti File */}
                {metode !== 'tunai' && billSummary.total > 0 && (
                  <div className="space-y-3">
                    <label className="block font-label-bold uppercase text-xs">Upload Bukti Pembayaran</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                      id="struk-bukti"
                    />
                    <label 
                      htmlFor="struk-bukti"
                      className="flex flex-col items-center justify-center border-4 border-dashed border-black p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                    >
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="max-h-32 object-contain" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-2xl mb-1 text-zinc-400">add_a_photo</span>
                          <p className="text-[10px] font-black uppercase text-zinc-500">Pilih Foto Struk</p>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={handleBayar}
                  disabled={billSummary.total === 0 || isSubmitting}
                  className="w-full bg-primary text-white border-4 border-black p-4 font-display-bold uppercase text-sm neubrutal-shadow-lg active-press disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Memproses...' : 'Kirim Konfirmasi Bayar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WargaLayout>
  )
}
