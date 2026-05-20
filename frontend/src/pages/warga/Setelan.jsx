import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

export default function WargaSetelan() {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    namaLengkap: '',
    nomorKK: '',
    noRumah: '',
    telepon: '',
    anggotaKeluarga: [],
  })
  const [newAnggota, setNewAnggota] = useState({ nama: '', nik: '' })

  useEffect(() => {
    const fetchProfil = async () => {
      try {
        const res = await api.get('/warga/me')
        const data = res.data
        setForm({
          namaLengkap: data.user?.nama || '',
          nomorKK: data.user?.nomorKK || '',
          noRumah: data.alamat || '',
          telepon: data.telepon || '',
          anggotaKeluarga: data.anggotaKeluarga || [],
        })
      } catch (error) {
        console.error('Failed to fetch profile', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProfil()
  }, [])

  const [loading, setLoading] = useState(true)

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.put('/warga/me', {
        nama: form.namaLengkap,
        alamat: form.noRumah,
        telepon: form.telepon,
        anggotaKeluarga: form.anggotaKeluarga
      })
      localStorage.setItem('nama', form.namaLengkap)
      setIsEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save profile', error)
      alert('Gagal menyimpan perubahan. Silakan coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  if (loading) {
    return (
      <WargaLayout>
        <div className="flex items-center justify-center h-64">
          <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
        </div>
      </WargaLayout>
    )
  }

  return (
    <WargaLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-lg">
          <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
            Setelan
          </h1>
          <p className="font-body-lg text-zinc-600">
            Kelola data diri dan informasi makam keluarga Anda.
          </p>
        </div>

        {/* Success Banner */}
        {saved && (
          <div className="bg-secondary text-white border-4 border-black p-4 mb-6 neubrutal-shadow flex items-center gap-3 animate-pulse">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-label-bold uppercase text-sm">Data berhasil disimpan!</span>
          </div>
        )}

        {/* Data Diri Section */}
        <div className="bg-white border-4 border-black neubrutal-shadow-lg mb-6">
          <div className="border-b-4 border-black p-4 md:p-md bg-zinc-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">person</span>
              <h2 className="font-headline-md uppercase text-base md:text-headline-md">Data Diri</h2>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-primary text-white border-2 border-black px-4 py-2 font-label-bold uppercase text-xs neubrutal-shadow active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit
              </button>
            )}
          </div>
          <div className="p-4 md:p-md space-y-5">
            {/* Nama Lengkap */}
            <div>
              <label className="font-label-bold text-xs uppercase text-zinc-500 mb-1 block">
                Nama Lengkap Kepala Keluarga
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.namaLengkap}
                  onChange={(e) => handleChange('namaLengkap', e.target.value)}
                  className="w-full border-3 border-black p-3 font-body-lg bg-tertiary-fixed/20 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  style={{ borderWidth: '3px' }}
                />
              ) : (
                <p className="font-body-lg p-3 bg-zinc-50 border-2 border-zinc-200">{form.namaLengkap}</p>
              )}
            </div>

            {/* Nomor KK */}
            <div>
              <label className="font-label-bold text-xs uppercase text-zinc-500 mb-1 block">
                Nomor Kartu Keluarga (KK)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.nomorKK}
                  onChange={(e) => handleChange('nomorKK', e.target.value)}
                  className="w-full border-3 border-black p-3 font-body-lg bg-tertiary-fixed/20 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all font-mono"
                  style={{ borderWidth: '3px' }}
                />
              ) : (
                <p className="font-body-lg p-3 bg-zinc-50 border-2 border-zinc-200 font-mono tracking-wider">
                  {form.nomorKK}
                </p>
              )}
            </div>

            {/* No Rumah */}
            <div>
              <label className="font-label-bold text-xs uppercase text-zinc-500 mb-1 block">
                Nomor Rumah
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.noRumah}
                  onChange={(e) => handleChange('noRumah', e.target.value)}
                  className="w-full border-3 border-black p-3 font-body-lg bg-tertiary-fixed/20 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  style={{ borderWidth: '3px' }}
                />
              ) : (
                <p className="font-body-lg p-3 bg-zinc-50 border-2 border-zinc-200">{form.noRumah}</p>
              )}
            </div>

            {/* No Telepon */}
            <div>
              <label className="font-label-bold text-xs uppercase text-zinc-500 mb-1 block">
                Nomor Telepon / WhatsApp
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={form.telepon}
                  onChange={(e) => handleChange('telepon', e.target.value)}
                  className="w-full border-3 border-black p-3 font-body-lg bg-tertiary-fixed/20 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  style={{ borderWidth: '3px' }}
                />
              ) : (
                <p className="font-body-lg p-3 bg-zinc-50 border-2 border-zinc-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-zinc-400">phone</span>
                  {form.telepon}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Anggota Keluarga Section */}
        <div className="bg-white border-4 border-black neubrutal-shadow-lg mb-6">
          <div className="border-b-4 border-black p-4 md:p-md bg-zinc-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">group</span>
              <h2 className="font-headline-md uppercase text-base md:text-headline-md">Anggota Keluarga</h2>
            </div>
            <div className="bg-primary text-white border-2 border-black px-4 py-2 font-label-bold uppercase text-xs">
              {form.anggotaKeluarga.length} Orang
            </div>
          </div>

          <div className="p-4 md:p-md">
            {/* Daftar Anggota */}
            <div className="space-y-2 mb-4">
              {form.anggotaKeluarga.length === 0 ? (
                <p className="text-zinc-500 text-sm italic">Belum ada anggota keluarga</p>
              ) : (
                form.anggotaKeluarga.map((anggota, idx) => {
                  const nama = typeof anggota === 'string' ? anggota : anggota.nama
                  const nik = typeof anggota === 'object' ? anggota.nik : ''
                  return (
                    <div key={idx} className="bg-zinc-50 border-2 border-zinc-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={nama}
                                onChange={(e) => {
                                  const updated = [...form.anggotaKeluarga]
                                  updated[idx] = { nama: e.target.value, nik }
                                  handleChange('anggotaKeluarga', updated)
                                }}
                                placeholder="Nama"
                                className="w-full border-2 border-black p-2 font-body-lg bg-white focus:outline-none"
                              />
                              <input
                                type="text"
                                value={nik}
                                onChange={(e) => {
                                  const updated = [...form.anggotaKeluarga]
                                  updated[idx] = { nama, nik: e.target.value }
                                  handleChange('anggotaKeluarga', updated)
                                }}
                                placeholder="NIK"
                                className="w-full border-2 border-black p-2 text-sm bg-white focus:outline-none"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="font-body-lg">{nama}</p>
                              <p className="text-xs text-zinc-500">NIK: {nik || '-'}</p>
                            </>
                          )}
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = form.anggotaKeluarga.filter((_, i) => i !== idx)
                              handleChange('anggotaKeluarga', updated)
                            }}
                            className="text-error hover:bg-error/10 p-1 rounded ml-2"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Tambah Anggota */}
            {isEditing && (
              <div className="space-y-2 border-2 border-dashed border-zinc-300 p-3">
                <p className="text-xs font-bold uppercase text-zinc-500">Tambah Anggota Baru</p>
                <input
                  type="text"
                  placeholder="Nama anggota keluarga"
                  value={newAnggota.nama}
                  onChange={(e) => setNewAnggota({ ...newAnggota, nama: e.target.value })}
                  className="w-full border-2 border-black p-2 font-body-lg bg-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="NIK (opsional)"
                  value={newAnggota.nik}
                  onChange={(e) => setNewAnggota({ ...newAnggota, nik: e.target.value })}
                  className="w-full border-2 border-black p-2 text-sm bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newAnggota.nama.trim()) {
                      handleChange('anggotaKeluarga', [...form.anggotaKeluarga, { nama: newAnggota.nama.trim(), nik: newAnggota.nik.trim() }])
                      setNewAnggota({ nama: '', nik: '' })
                    }
                  }}
                  className="w-full bg-primary text-white border-2 border-black p-2 font-label-bold uppercase flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">add</span>
                  Tambah Anggota
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons (when editing) */}
        {isEditing && (
          <div className="flex gap-4 mb-24 md:mb-8">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-primary text-white border-4 border-black p-4 font-display-bold uppercase text-base neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Menyimpan...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">save</span>
                  Simpan Perubahan
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              className="bg-white text-black border-4 border-black p-4 font-display-bold uppercase text-base neubrutal-shadow active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">close</span>
              Batal
            </button>
          </div>
        )}

        {/* Keamanan Section */}
        {!isEditing && (
          <div className="bg-white border-4 border-black neubrutal-shadow-lg mb-6">
            <div className="border-b-4 border-black p-4 md:p-md bg-zinc-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">security</span>
              <h2 className="font-headline-md uppercase text-base md:text-headline-md">Keamanan</h2>
            </div>
            <div className="p-4 md:p-md">
              <button
                onClick={() => navigate('/warga/ubah-password')}
                className="w-full bg-white border-2 border-black p-4 font-label-bold uppercase text-sm flex items-center justify-between hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">lock</span>
                  <span>Ubah Password</span>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        )}

        {/* Info Card & Logout */}
        {!isEditing && (
          <div className="space-y-4 mb-24 md:mb-8">
            <div className="bg-tertiary-fixed border-4 border-black p-4 md:p-md neubrutal-shadow flex items-start gap-4">
              <span className="material-symbols-outlined text-2xl shrink-0">info</span>
              <div>
                <h4 className="font-headline-md text-sm uppercase mb-1">Penting</h4>
                <p className="text-xs leading-relaxed">
                  Pastikan data diri dan informasi makam selalu diperbarui agar perhitungan iuran sesuai.
                  Jika terdapat perubahan data, silakan hubungi pengurus RT untuk verifikasi.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.clear()
                navigate('/')
              }}
              className="w-full bg-error text-white border-4 border-black p-4 font-display-bold uppercase text-base neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">logout</span>
              Keluar dari Akun
            </button>
          </div>
        )}
      </div>
    </WargaLayout>
  )
}
