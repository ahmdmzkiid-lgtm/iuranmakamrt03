import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

export default function AdminMakam() {
  const [wargaList, setWargaList] = useState([])
  const [loading, setLoading] = useState(true)

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

  const totalMakam = wargaList.reduce((sum, w) => sum + (w.jumlahMakam || 0), 0)
  const totalAlmarhum = wargaList.reduce((sum, w) => sum + (w.daftarAlmarhum?.length || 0), 0)

  return (
    <AdminLayout activeLabel="Makam">
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-lg">
          <div>
            <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase">
              Manajemen Makam Keseluruhan
            </h1>
            <p className="font-body-lg text-zinc-600 mt-2">
              Data seluruh titik makam dan almarhum yang dikelola di lingkungan RT.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-lg">
          <div className="bg-primary-container border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1">
            <span className="material-symbols-outlined text-3xl mb-2 text-white">church</span>
            <p className="font-display-bold text-2xl md:text-headline-lg text-white">{totalMakam} Makam</p>
            <p className="font-label-bold text-[10px] uppercase text-white opacity-70 mt-1">Total Makam Terdaftar</p>
          </div>
          <div className="bg-secondary-container border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1">
            <span className="material-symbols-outlined text-3xl mb-2 text-black">groups</span>
            <p className="font-display-bold text-2xl md:text-headline-lg text-black">{totalAlmarhum} Jiwa</p>
            <p className="font-label-bold text-[10px] uppercase text-black opacity-70 mt-1">Total Almarhum Terdata</p>
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
            <h2 className="font-headline-md uppercase text-sm md:text-base">Daftar Makam & Almarhum</h2>
            <div className="flex items-center gap-2 w-full md:w-auto bg-white border-2 border-black px-3 py-1">
              <span className="material-symbols-outlined text-zinc-400">search</span>
              <input 
                type="text" 
                placeholder="Cari warga/almarhum..." 
                className="w-full md:w-64 text-sm focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-200 border-b-4 border-black font-label-bold text-xs uppercase">
                  <th className="p-4">Nama Warga (KK)</th>
                  <th className="p-4 text-center">Unit Makam</th>
                  <th className="p-4">Daftar Almarhum / Almarhumah</th>
                  <th className="p-4 text-center">Tahun Wafat</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center">
                      <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                    </td>
                  </tr>
                ) : wargaList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center font-bold uppercase text-zinc-400">Belum ada data</td>
                  </tr>
                ) : (
                  wargaList.map((warga) => {
                    const almarhum = warga.daftarAlmarhum || []
                    return (
                      <tr key={warga.id} className="border-b-2 border-zinc-200 hover:bg-zinc-50 transition-colors align-top">
                        <td className="p-4">
                          <p className="font-bold text-sm">{warga.user?.nama}</p>
                          <p className="text-[10px] text-zinc-500 uppercase">KK: {warga.user?.nomorKK}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-block bg-primary text-white border-2 border-black px-2 py-1 font-display-bold text-sm">
                            {warga.jumlahMakam}
                          </span>
                        </td>
                        <td className="p-4">
                          {almarhum.length > 0 ? (
                            <div className="space-y-2">
                              {almarhum.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                  <span className="text-sm">{p.nama || 'Fulan'}</span>
                                  <span className="text-[10px] bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 uppercase font-bold text-zinc-500">
                                    {p.hubungan || 'Keluarga'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : warga.jumlahMakam > 0 ? (
                            <div className="space-y-2">
                              {Array.from({ length: warga.jumlahMakam }).map((_, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                  <span className="text-sm">Fulan</span>
                                  <span className="text-[10px] bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 uppercase font-bold text-zinc-400">
                                    Belum Diisi
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs italic text-zinc-400">Tidak ada makam</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {almarhum.length > 0 ? (
                            <div className="space-y-2">
                              {almarhum.map((p, idx) => (
                                <div key={idx} className="text-sm font-display-bold leading-[22px]">
                                  {p.tahunWafat || '-'}
                                </div>
                              ))}
                            </div>
                          ) : warga.jumlahMakam > 0 ? (
                            <div className="space-y-2">
                              {Array.from({ length: warga.jumlahMakam }).map((_, idx) => (
                                <div key={idx} className="text-sm font-display-bold leading-[22px]">
                                  -
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
