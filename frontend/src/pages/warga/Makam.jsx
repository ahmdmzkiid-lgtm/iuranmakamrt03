import { useState, useEffect } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

export default function WargaMakam() {
  const [loading, setLoading] = useState(true)
  const [wargaData, setWargaData] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/warga/me')
        setWargaData(res.data)
      } catch (error) {
        console.error('Failed to fetch burial data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const almarhumList = wargaData?.daftarAlmarhum || []

  return (
    <WargaLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-lg">
          <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
            Makam Keluarga
          </h1>
          <p className="font-body-lg text-zinc-600">
            Daftar almarhum/almarhumah keluarga Anda yang terdaftar dalam iuran.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stats Card */}
            <div className="bg-primary-container border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1 col-span-1 md:col-span-2">
              <span className="material-symbols-outlined text-3xl mb-2 text-white">church</span>
              <p className="font-display-bold text-2xl md:text-headline-lg text-white">{wargaData?.jumlahMakam || 0} Makam</p>
              <p className="font-label-bold text-[10px] uppercase text-white opacity-70 mt-1">Total Makam Terdaftar</p>
            </div>

            {/* Burial List */}
            <div className="col-span-1 md:col-span-2 space-y-4">
              <h3 className="font-headline-md uppercase flex items-center gap-2">
                <span className="material-symbols-outlined">groups</span>
                Daftar Almarhum / Almarhumah
              </h3>
              
              {(almarhumList.length > 0 || (wargaData?.jumlahMakam > 0)) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Real Data or Fulan Placeholders */}
                  {(almarhumList.length > 0 ? almarhumList : Array.from({ length: wargaData?.jumlahMakam || 0 }, () => ({}))).map((person, index) => (
                    <div key={index} className="bg-white border-4 border-black p-4 neubrutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-zinc-100 border-2 border-black flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-zinc-400">{person.nama ? 'person_off' : 'help'}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm md:text-base uppercase truncate">{person.nama || 'Fulan'}</h4>
                          <p className="text-[10px] font-label-bold uppercase text-zinc-500">{person.hubungan || (person.nama ? 'Keluarga' : 'Belum Diisi')}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t-2 border-black flex justify-between items-center">
                        <span className="text-[10px] font-label-bold uppercase text-zinc-400">Tahun Wafat</span>
                        <span className="font-display-bold text-lg">{person.tahunWafat || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border-4 border-dashed border-zinc-300 p-12 text-center neubrutal-shadow">
                  <span className="material-symbols-outlined text-6xl text-zinc-200 mb-4">sentiment_dissatisfied</span>
                  <p className="font-headline-md uppercase text-zinc-400">Belum ada data almarhum</p>
                  <p className="text-sm text-zinc-400 mt-2">Silakan tambahkan data di menu Setelan.</p>
                </div>
              )}
            </div>

            {/* Info Card */}
            <div className="bg-tertiary-fixed border-4 border-black p-6 neubrutal-shadow col-span-1 md:col-span-2">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-3xl">info</span>
                <div>
                  <h4 className="font-headline-md uppercase text-sm mb-1">Informasi</h4>
                  <p className="text-xs leading-relaxed">
                    Data di atas adalah ringkasan makam yang menjadi tanggung jawab iuran Anda. 
                    Jika terdapat ketidaksesuaian jumlah makam atau nama almarhum, silakan perbarui melalui menu <strong>Setelan</strong> atau hubungi pengurus RT untuk sinkronisasi data fisik di lapangan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WargaLayout>
  )
}
