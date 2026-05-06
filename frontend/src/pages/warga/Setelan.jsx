import { useState, useEffect } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

export default function WargaSetelan() {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    namaLengkap: '',
    nomorKK: '',
    noRumah: '',
    telepon: '',
    jumlahMakam: 1,
    almarhum: [],
  })

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
          jumlahMakam: data.jumlahMakam || 1,
          almarhum: data.daftarAlmarhum || [],
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

  const handleAlmarhumChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.almarhum]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, almarhum: updated }
    })
  }

  const addAlmarhum = () => {
    setForm((prev) => ({
      ...prev,
      almarhum: [...prev.almarhum, { nama: '', hubungan: '', tahunWafat: '' }],
      jumlahMakam: prev.jumlahMakam + 1,
    }))
  }

  const removeAlmarhum = (index) => {
    setForm((prev) => ({
      ...prev,
      almarhum: prev.almarhum.filter((_, i) => i !== index),
      jumlahMakam: Math.max(0, prev.jumlahMakam - 1),
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.put('/warga/me', {
        nama: form.namaLengkap,
        alamat: form.noRumah,
        telepon: form.telepon,
        jumlahMakam: form.jumlahMakam,
        daftarAlmarhum: form.almarhum
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

        {/* Informasi Makam Section */}
        <div className="bg-white border-4 border-black neubrutal-shadow-lg mb-6">
          <div className="border-b-4 border-black p-4 md:p-md bg-zinc-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">church</span>
              <h2 className="font-headline-md uppercase text-base md:text-headline-md">Informasi Makam</h2>
            </div>
            <div className="bg-primary text-white border-2 border-black px-4 py-2 font-label-bold uppercase text-xs">
              {form.jumlahMakam} Makam
            </div>
          </div>

          <div className="p-4 md:p-md">
            {/* Jumlah Makam */}
            <div className="mb-6">
              <label className="font-label-bold text-xs uppercase text-zinc-500 mb-1 block">
                Jumlah Makam
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={form.jumlahMakam}
                  onChange={(e) => handleChange('jumlahMakam', parseInt(e.target.value) || 0)}
                  className="w-32 border-3 border-black p-3 font-body-lg bg-tertiary-fixed/20 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-center"
                  style={{ borderWidth: '3px' }}
                />
              ) : (
                <p className="font-body-lg p-3 bg-zinc-50 border-2 border-zinc-200 w-32 text-center">
                  {form.jumlahMakam}
                </p>
              )}
            </div>

            {/* Daftar Almarhum/Almarhumah */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="font-label-bold text-xs uppercase text-zinc-500">
                  Daftar Almarhum / Almarhumah
                </label>
                {isEditing && (
                  <button
                    onClick={addAlmarhum}
                    className="bg-tertiary-fixed text-black border-2 border-black px-3 py-1.5 font-label-bold uppercase text-xs neubrutal-shadow active:translate-y-1 active:shadow-none transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Tambah
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {form.almarhum.map((item, idx) => (
                  <div
                    key={idx}
                    className="border-3 border-black p-4 bg-surface-container-low relative"
                    style={{ borderWidth: '3px' }}
                  >
                    {isEditing && (
                      <button
                        onClick={() => removeAlmarhum(idx)}
                        className="absolute top-2 right-2 bg-error text-white border-2 border-black w-8 h-8 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-black text-white w-7 h-7 flex items-center justify-center font-label-bold text-xs">
                        {idx + 1}
                      </span>
                      <span className="font-label-bold uppercase text-xs text-zinc-500">
                        Data Almarhum/ah #{idx + 1}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="text-[10px] uppercase font-label-bold text-zinc-400 mb-1 block">
                          Nama
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.nama}
                            onChange={(e) => handleAlmarhumChange(idx, 'nama', e.target.value)}
                            placeholder="Nama almarhum/ah"
                            className="w-full border-2 border-black p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <p className="text-sm font-body-lg">{item.nama || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-label-bold text-zinc-400 mb-1 block">
                          Hubungan
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.hubungan}
                            onChange={(e) => handleAlmarhumChange(idx, 'hubungan', e.target.value)}
                            placeholder="Contoh: Ayah, Ibu"
                            className="w-full border-2 border-black p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <p className="text-sm font-body-lg">{item.hubungan || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-label-bold text-zinc-400 mb-1 block">
                          Tahun Wafat
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.tahunWafat}
                            onChange={(e) => handleAlmarhumChange(idx, 'tahunWafat', e.target.value)}
                            placeholder="2024"
                            className="w-full border-2 border-black p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <p className="text-sm font-body-lg">{item.tahunWafat || '-'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {form.almarhum.length === 0 && (
                  <div className="border-2 border-dashed border-zinc-300 p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-zinc-300 mb-2 block">
                      sentiment_neutral
                    </span>
                    <p className="text-zinc-400 font-label-bold uppercase text-xs">
                      Belum ada data almarhum
                    </p>
                  </div>
                )}
              </div>
            </div>
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
