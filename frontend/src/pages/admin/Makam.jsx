import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

export default function AdminMakam() {
  const [wargaList, setWargaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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
  const totalWarga = wargaList.reduce((sum, w) => {
    const anggota = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga.length : 0
    return sum + 1 + anggota // 1 kepala keluarga + anggota
  }, 0)

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
                ) : wargaList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center font-bold uppercase text-zinc-400">Belum ada data</td>
                  </tr>
                ) : (
                  wargaList
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
                    .map((warga) => (
                    <tr key={warga.id} className="border-b-2 border-zinc-200 hover:bg-zinc-50 transition-colors align-top">
                      <td className="p-4">
                        <p className="font-bold text-sm">{warga.user?.nama}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">KK: {warga.user?.nomorKK}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-block bg-primary text-white border-2 border-black px-2 py-1 font-display-bold text-sm">
                          {Array.isArray(warga.anggotaKeluarga) ? warga.anggotaKeluarga.length : 0}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block border-2 border-black px-2 py-1 font-display-bold text-sm ${warga.sisaBulanMakam === 0 ? 'bg-green-500 text-white' : warga.sisaBulanMakam <= 6 ? 'bg-tertiary-fixed text-black' : 'bg-zinc-100 text-black'}`}>
                            {warga.bulanMakamLunas || 0}/{warga.totalBulanMakam || 36}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {warga.sisaBulanMakam === 0 ? 'LUNAS' : `Sisa ${warga.sisaBulanMakam} bln`}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm">{warga.alamat || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
