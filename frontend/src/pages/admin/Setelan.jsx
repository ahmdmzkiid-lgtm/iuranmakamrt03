import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'

export default function AdminSetelan() {
  const navigate = useNavigate()
  const { showAlert } = useNotification()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    bank_name: '',
    bank_account: '',
    bank_holder: '',
    qris_url: ''
  })
  const [qrisFile, setQrisFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings')
        setSettings({
          bank_name: res.data.bank_name || '',
          bank_account: res.data.bank_account || '',
          bank_holder: res.data.bank_holder || '',
          qris_url: res.data.qris_url || ''
        })
        if (res.data.qris_url) {
          const qrisUrl = res.data.qris_url
          setPreviewUrl(qrisUrl.startsWith('http') ? qrisUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${qrisUrl}`)
        }
      } catch (error) {
        console.error('Failed to fetch settings', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setQrisFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('bank_name', settings.bank_name)
      formData.append('bank_account', settings.bank_account)
      formData.append('bank_holder', settings.bank_holder)
      if (qrisFile) {
        formData.append('qris', qrisFile)
      }

      await api.post('/settings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      showAlert('Pengaturan berhasil disimpan!')
    } catch (error) {
      console.error('Failed to save settings', error)
      showAlert('Gagal menyimpan pengaturan')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout activeLabel="Settings">
        <div className="flex items-center justify-center h-64">
          <p className="font-display-bold uppercase animate-pulse">Memuat Pengaturan...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout activeLabel="Settings">
      <div className="max-w-4xl mx-auto">
        <div className="mb-lg">
          <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase">Setelan Sistem</h1>
          <p className="font-body-lg text-zinc-600 mt-2">
            Kelola informasi rekening pembayaran dan QRIS untuk warga.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-gutter">
          {/* Bank Account Section */}
          <div className="bg-white border-4 border-black neubrutal-shadow-lg">
            <div className="border-b-4 border-black p-4 bg-zinc-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
              <h2 className="font-headline-md uppercase">Informasi Rekening Bank</h2>
            </div>
            <div className="p-4 md:p-md space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="font-label-bold text-xs uppercase text-zinc-500 mb-2 block">Nama Bank</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={settings.bank_name}
                    onChange={handleChange}
                    placeholder="Contoh: BCA, Mandiri, BRI"
                    className="w-full border-4 border-black p-3 font-body-lg focus:bg-tertiary-fixed focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="font-label-bold text-xs uppercase text-zinc-500 mb-2 block">Nomor Rekening</label>
                  <input
                    type="text"
                    name="bank_account"
                    value={settings.bank_account}
                    onChange={handleChange}
                    placeholder="Contoh: 1234567890"
                    className="w-full border-4 border-black p-3 font-body-lg focus:bg-tertiary-fixed focus:outline-none transition-all font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="font-label-bold text-xs uppercase text-zinc-500 mb-2 block">Nama Pemilik Rekening (Atas Nama)</label>
                <input
                  type="text"
                  name="bank_holder"
                  value={settings.bank_holder}
                  onChange={handleChange}
                  placeholder="Contoh: RT 03 LIMO"
                  className="w-full border-4 border-black p-3 font-body-lg focus:bg-tertiary-fixed focus:outline-none transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* QRIS Section */}
          <div className="bg-white border-4 border-black neubrutal-shadow-lg">
            <div className="border-b-4 border-black p-4 bg-zinc-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">qr_code_2</span>
              <h2 className="font-headline-md uppercase">Pembayaran QRIS</h2>
            </div>
            <div className="p-4 md:p-md">
              <div className="flex flex-col md:flex-row gap-gutter items-start">
                <div className="w-full md:w-1/3">
                  <div className="border-4 border-black p-2 bg-white neubrutal-shadow">
                    {previewUrl ? (
                      <img src={previewUrl} alt="QRIS Preview" className="w-full aspect-square object-contain" />
                    ) : (
                      <div className="w-full aspect-square bg-zinc-100 flex flex-col items-center justify-center text-zinc-400">
                        <span className="material-symbols-outlined text-4xl mb-2">image_not_supported</span>
                        <p className="text-[10px] uppercase font-bold">Belum ada QRIS</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Unggah kode QRIS RT Anda di sini. Warga dapat memindai kode ini langsung dari aplikasi mereka untuk melakukan pembayaran yang lebih cepat.
                  </p>
                  <input
                    type="file"
                    id="qris-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="qris-upload"
                    className="inline-flex items-center gap-2 bg-secondary text-white border-2 border-black px-4 py-2 font-label-bold uppercase text-xs neubrutal-shadow hover:bg-black transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">upload</span>
                    Pilih Gambar QRIS
                  </label>
                  {qrisFile && (
                    <p className="text-[10px] font-mono text-zinc-500 italic mt-1">Terpilih: {qrisFile.name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 pb-12">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-primary text-white border-4 border-black px-8 py-4 font-display-bold uppercase text-base neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Menyimpan...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">save</span>
                  Simpan Semua Perubahan
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                localStorage.clear()
                navigate('/')
              }}
              className="w-full bg-error text-white border-4 border-black px-8 py-4 font-display-bold uppercase text-base neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">logout</span>
              Keluar dari Akun Admin
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
