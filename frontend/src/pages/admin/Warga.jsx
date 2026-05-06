import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'
import { generateExcelReport } from '../../utils/excelReport'

export default function AdminWarga() {
  const [wargaData, setWargaData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('SEMUA STATUS')
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)
  const { showAlert, showConfirm } = useNotification()
  const [formData, setFormData] = useState({
    nama: '',
    nomorKK: '',
    password: '',
    alamat: '',
    telepon: '',
    jumlahMakam: 1,
    bulanTerbayar: 0,
    daftarAlmarhum: []
  })

  const [iuranData, setIuranData] = useState([])
  
  const fetchWarga = async () => {
    try {
      setLoading(true)
      const [resWarga, resIuran] = await Promise.all([
        api.get('/warga'),
        api.get('/iuran')
      ])
      setWargaData(resWarga.data)
      setIuranData(resIuran.data)
    } catch (error) {
      console.error('Failed to fetch data', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWarga()
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      if (isEditing) {
        await api.put(`/warga/${editId}`, formData)
      } else {
        await api.post('/warga', formData)
      }
      closeModal()
      fetchWarga()
    } catch (error) {
      showAlert(error.response?.data?.error || 'Gagal menyimpan data warga')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!(await showConfirm('Apakah Anda yakin ingin menghapus warga ini? Semua data iuran terkait juga akan terhapus.'))) return
    try {
      await api.delete(`/warga/${id}`)
      fetchWarga()
    } catch (error) {
      console.error('Failed to delete warga', error)
      showAlert('Gagal menghapus warga')
    }
  }

  const handleEdit = (warga) => {
    setIsEditing(true)
    setEditId(warga.id)
    setFormData({
      nama: warga.user?.nama || '',
      nomorKK: warga.user?.nomorKK || '',
      password: '', // Kosongkan password saat edit
      alamat: warga.alamat || '',
      telepon: warga.telepon || '',
      jumlahMakam: warga.jumlahMakam || 1,
      bulanTerbayar: warga.bulanTerbayar || 0,
      daftarAlmarhum: warga.daftarAlmarhum || []
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setIsEditing(false)
    setEditId(null)
    setFormData({
      nama: '', nomorKK: '', password: '', alamat: '', telepon: '', jumlahMakam: 1, bulanTerbayar: 0, daftarAlmarhum: []
    })
  }

  const totalWarga = wargaData.length
  // Sementara asumsikan semua warga aktif untuk demo jika tidak ada flag khusus
  const wargaAktif = wargaData.length 
  
  // Hitung kelengkapan KK (asumsikan KK lengkap jika ada user.nomorKK)
  const kkLengkap = wargaData.filter(w => w.user?.nomorKK).length
  const kkPercent = totalWarga > 0 ? Math.round((kkLengkap / totalWarga) * 100) : 0

  const filteredData = wargaData.filter(w => {
    const nama = w.user?.nama?.toLowerCase() || ''
    const kk = w.user?.nomorKK?.toLowerCase() || ''
    const matchesSearch = nama.includes(searchQuery.toLowerCase()) || kk.includes(searchQuery.toLowerCase())
    
    // Karena kita saat ini belum punya field status_warga, kita tampilkan semua, atau bisa difilter
    // jika nanti ada field khusus. Untuk sekarang semua dianggap 'aktif'
    const status = 'aktif'
    const matchesStatus = statusFilter === 'SEMUA STATUS' || statusFilter.toLowerCase() === status
    
    return matchesSearch && matchesStatus
  })

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-lg">
          <div className="space-y-2">
            <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase">
              Kelola Data Warga
            </h1>
            <p className="font-body-lg text-zinc-600 max-w-xl">
              Pusat administrasi kependudukan tingkat RT. Kelola status, alamat, dan nomor kartu keluarga secara efisien.
            </p>
          </div>
          <button 
            onClick={() => {
              setIsEditing(false)
              setShowModal(true)
            }}
            className="bg-secondary text-on-secondary border-4 border-black px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-headline-md uppercase neubrutal-shadow active-press flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <span className="material-symbols-outlined">person_add</span>
            Tambah Warga
          </button>
        </div>

        {/* Modal Tambah/Edit Warga */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto neubrutal-shadow flex flex-col">
              <div className="p-4 md:p-6 border-b-4 border-black flex justify-between items-center bg-surface-bright sticky top-0 z-10">
                <h2 className="font-display-bold text-xl md:text-2xl uppercase">
                  {isEditing ? 'Edit Data Warga' : 'Tambah Warga Baru'}
                </h2>
                <button onClick={closeModal} className="hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-4 md:p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Nama Lengkap</label>
                      <input required type="text" name="nama" value={formData.nama} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-tertiary-fixed focus:outline-none transition-colors" placeholder="Cth: Budi Santoso" />
                    </div>
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Nomor KK (Username Login)</label>
                      <input required type="text" name="nomorKK" value={formData.nomorKK} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-tertiary-fixed focus:outline-none transition-colors" placeholder="Cth: 317500123456" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-label-bold uppercase mb-2">
                        Password Login {isEditing && <span className="text-zinc-400 font-normal">(Kosongkan jika tidak diganti)</span>}
                      </label>
                      <input required={!isEditing} type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-tertiary-fixed focus:outline-none transition-colors" placeholder={isEditing ? 'Isi untuk ganti password...' : 'Set password default...'} />
                    </div>
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Nomor Telepon</label>
                      <input type="tel" name="telepon" value={formData.telepon} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-tertiary-fixed focus:outline-none transition-colors" placeholder="0812..." />
                    </div>
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">No Rumah</label>
                    <input type="text" name="alamat" value={formData.alamat} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-tertiary-fixed focus:outline-none transition-colors" placeholder="Cth: Blok A No 12" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-tertiary-fixed p-4 border-4 border-black">
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Jumlah Makam</label>
                      <input required type="number" min="1" name="jumlahMakam" value={formData.jumlahMakam} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Bulan Terbayar Sebelumnya</label>
                      <input required type="number" min="0" max="35" name="bulanTerbayar" value={formData.bulanTerbayar} onChange={handleInputChange} className="w-full px-4 py-3 border-4 border-black font-body-md focus:bg-white focus:outline-none transition-colors" />
                      <p className="text-xs font-body-md mt-1 text-zinc-600">Sisa bulan akan dihitung dari 35 bulan.</p>
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end gap-4">
                    <button type="button" onClick={closeModal} className="px-6 py-3 border-4 border-black font-label-bold uppercase hover:bg-surface-variant transition-colors">Batal</button>
                    <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-primary text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press disabled:opacity-50">
                      {isSubmitting ? 'Menyimpan...' : (isEditing ? 'Update Warga' : 'Simpan Warga')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-gutter mb-lg">
          <div className="bg-tertiary-fixed border-4 border-black p-md neubrutal-shadow">
            <p className="font-label-bold uppercase mb-2">Total Warga</p>
            <p className="font-display-bold text-2xl md:text-headline-lg">{loading ? '...' : totalWarga}</p>
          </div>
          <div className="bg-secondary-container border-4 border-black p-md neubrutal-shadow">
            <p className="font-label-bold uppercase mb-2">Warga Aktif</p>
            <p className="font-display-bold text-2xl md:text-headline-lg">{loading ? '...' : wargaAktif}</p>
          </div>
          <div className="col-span-1 md:col-span-2 bg-white border-4 border-black p-md neubrutal-shadow flex items-center justify-between">
            <div>
              <p className="font-label-bold uppercase mb-2">Kelengkapan Data KK</p>
              <p className="font-display-bold text-2xl md:text-headline-lg">{loading ? '...' : `${kkPercent}%`}</p>
            </div>
            <div className="w-32 h-4 bg-surface-variant border-2 border-black overflow-hidden">
              <div className="h-full bg-primary border-r-2 border-black transition-all duration-1000" style={{ width: `${kkPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white border-4 border-black neubrutal-shadow overflow-hidden mb-lg">
          {/* Controls */}
          <div className="p-4 md:p-gutter border-b-4 border-black flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-bright">
            <div className="relative w-full md:w-96">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-black">search</span>
              <input
                className="w-full pl-12 pr-4 py-3 bg-white border-4 border-black font-label-bold focus:bg-tertiary-fixed focus:outline-none transition-all"
                placeholder="CARI NAMA ATAU NO. KK..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <select 
                className="flex-grow md:flex-grow-0 px-4 py-3 border-4 border-black font-label-bold uppercase focus:outline-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>SEMUA STATUS</option>
                <option>AKTIF</option>
                <option>TIDAK AKTIF</option>
              </select>
              <button className="bg-white border-4 border-black p-2 md:p-3 neubrutal-shadow hover:bg-tertiary-fixed transition-all shrink-0">
                <span className="material-symbols-outlined">filter_list</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-secondary-container text-black uppercase font-label-bold text-left border-b-4 border-black">
                  <th className="p-4 md:p-gutter border-r-4 border-black">Nama Lengkap</th>
                  <th className="p-4 md:p-gutter border-r-4 border-black">Nomor KK</th>
                  <th className="p-4 md:p-gutter border-r-4 border-black">Jml Makam</th>
                  <th className="p-4 md:p-gutter border-r-4 border-black">Sisa Bulan</th>
                  <th className="p-4 md:p-gutter border-r-4 border-black">No Rumah</th>
                  <th className="p-4 md:p-gutter">Aksi</th>
                </tr>
              </thead>
              <tbody className="font-body-md">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-4 md:p-gutter text-center font-label-bold uppercase">Memuat data...</td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 md:p-gutter text-center font-label-bold uppercase text-zinc-500">Tidak ada data warga.</td>
                  </tr>
                ) : (
                  filteredData.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b-4 border-black hover:bg-surface-container-low transition-colors ${
                        idx % 2 === 1 ? 'bg-surface-bright' : ''
                      }`}
                    >
                      <td className="p-4 md:p-gutter border-r-4 border-black font-bold">{row.user?.nama}</td>
                      <td className="p-4 md:p-gutter border-r-4 border-black font-mono text-sm">{row.user?.nomorKK || '-'}</td>
                      <td className="p-4 md:p-gutter border-r-4 border-black text-center font-bold">
                        {row.jumlahMakam}
                      </td>
                      <td className="p-4 md:p-gutter border-r-4 border-black text-center font-bold">
                        {Math.max(0, 35 - (row.bulanTerbayar || 0))} bln
                      </td>
                      <td className="p-4 md:p-gutter border-r-4 border-black text-sm">{row.alamat || '-'}</td>
                      <td className="p-4 md:p-gutter flex gap-2">
                        <button 
                          onClick={() => handleEdit(row)}
                          className="p-2 border-2 border-black bg-tertiary-fixed hover:bg-tertiary-container transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(row.id)}
                          className="p-2 border-2 border-black bg-error-container hover:bg-error transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredData.length > 0 && (
            <div className="p-4 md:p-gutter flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <p className="font-label-bold text-xs uppercase">Menampilkan 1-{filteredData.length} dari {wargaData.length} warga</p>
              <div className="flex gap-2">
                <button className="w-10 h-10 border-2 border-black flex items-center justify-center bg-surface-variant opacity-50 cursor-not-allowed">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="w-10 h-10 border-2 border-black flex items-center justify-center bg-primary text-white neubrutal-shadow">1</button>
                <button className="w-10 h-10 border-2 border-black flex items-center justify-center bg-surface-variant opacity-50 cursor-not-allowed">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Payment Status for Current Month */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-gutter mb-lg">
          {/* Sudah Bayar Bulan Ini */}
          <div className="bg-white border-4 border-black neubrutal-shadow-lg">
            <div className="bg-secondary text-white p-4 border-b-4 border-black flex justify-between items-center">
              <h3 className="font-display-bold text-sm md:text-base uppercase">Sudah Bayar Bulan Ini</h3>
              <span className="bg-white text-black px-2 py-1 text-[10px] font-black border-2 border-black">
                {wargaData.filter(w => iuranData.some(i => i.wargaId === w.id && i.bulan === (new Date().getMonth() + 1) && i.tahun === new Date().getFullYear() && i.status === 'lunas')).length} WARGA
              </span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-100 border-b-2 border-black sticky top-0">
                  <tr>
                    <th className="p-3 text-[10px] font-black uppercase border-r-2 border-black">Nama Warga</th>
                    <th className="p-3 text-[10px] font-black uppercase">Metode</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {wargaData
                    .filter(w => iuranData.some(i => i.wargaId === w.id && i.bulan === (new Date().getMonth() + 1) && i.tahun === new Date().getFullYear() && i.status === 'lunas'))
                    .map((w, idx) => {
                      const iuran = iuranData.find(i => i.wargaId === w.id && i.bulan === (new Date().getMonth() + 1) && i.tahun === new Date().getFullYear() && i.status === 'lunas')
                      return (
                        <tr key={idx} className="border-b-2 border-black last:border-b-0">
                          <td className="p-3 border-r-2 border-black font-bold">{w.user?.nama}</td>
                          <td className="p-3 font-bold text-secondary uppercase">{iuran?.metode || '-'}</td>
                        </tr>
                      )
                    })}
                  {wargaData.filter(w => iuranData.some(i => i.wargaId === w.id && i.bulan === (new Date().getMonth() + 1) && i.tahun === new Date().getFullYear() && i.status === 'lunas')).length === 0 && (
                    <tr><td colSpan="2" className="p-4 text-center text-zinc-400 italic">Belum ada yang membayar</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Belum Bayar Bulan Ini */}
          <div className="bg-white border-4 border-black neubrutal-shadow-lg">
            <div className="bg-error text-white p-4 border-b-4 border-black flex justify-between items-center">
              <h3 className="font-display-bold text-sm md:text-base uppercase">Belum Bayar Bulan Ini</h3>
              <span className="bg-white text-black px-2 py-1 text-[10px] font-black border-2 border-black">
                {wargaData.filter(w => !iuranData.some(i => i.wargaId === w.id && i.bulan === (new Date().getMonth() + 1) && i.tahun === new Date().getFullYear() && i.status === 'lunas')).length} WARGA
              </span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-100 border-b-2 border-black sticky top-0">
                  <tr>
                    <th className="p-3 text-[10px] font-black uppercase border-r-2 border-black">Nama Warga</th>
                    <th className="p-3 text-[10px] font-black uppercase">Tagihan Bulan Ini</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {wargaData
                    .filter(w => !iuranData.some(i => i.wargaId === w.id && i.bulan === (new Date().getMonth() + 1) && i.tahun === new Date().getFullYear() && i.status === 'lunas'))
                    .map((w, idx) => {
                      const tagihanBulanIni = (w.jumlahMakam || 1) * 10000
                      return (
                        <tr key={idx} className="border-b-2 border-black last:border-b-0">
                          <td className="p-3 border-r-2 border-black font-bold">{w.user?.nama}</td>
                          <td className="p-3 font-bold text-error">Rp {tagihanBulanIni.toLocaleString('id-ID')}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Contextual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-gutter mb-24 md:mb-0">
          <div className="bg-primary-container border-4 border-black p-4 md:p-gutter neubrutal-shadow relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-headline-md text-white mb-2 uppercase">Butuh Export Data?</h3>
              <p className="text-white font-body-md mb-4">
                Download data warga dalam format Excel atau PDF untuk laporan bulanan Kelurahan.
              </p>
              <button 
                onClick={() => generateExcelReport(wargaData, iuranData)}
                className="bg-tertiary-fixed border-2 border-black px-4 py-2 font-label-bold uppercase neubrutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Download .XLSX
              </button>
            </div>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-white opacity-20 text-[120px] rotate-12">
              cloud_download
            </span>
          </div>
          <div className="bg-white border-4 border-black p-4 md:p-gutter neubrutal-shadow flex items-center gap-4 md:gap-6">
            <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-black bg-tertiary-fixed shrink-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl md:text-4xl">info</span>
            </div>
            <div>
              <h3 className="font-headline-md mb-2 uppercase">Panduan Admin</h3>
              <p className="font-body-md text-sm">
                Gunakan fitur pencarian untuk menemukan warga berdasarkan nama atau NIK. Pastikan status warga selalu diperbarui setiap ada kepindahan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
