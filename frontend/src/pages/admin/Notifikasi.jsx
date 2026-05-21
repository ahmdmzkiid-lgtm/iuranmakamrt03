import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function AdminNotifikasi() {
  const [wargaList, setWargaList] = useState([])
  const [selectedWarga, setSelectedWarga] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState('reminder') // reminder | custom
  const [searchTerm, setSearchTerm] = useState('')
  const { showAlert, showConfirm } = useNotification()

  // Reminder form
  const [reminderData, setReminderData] = useState({
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    message: ''
  })

  // Custom notification form
  const [customData, setCustomData] = useState({
    title: '',
    message: '',
    sendToAll: false
  })

  useEffect(() => {
    fetchWarga()
  }, [])

  const fetchWarga = async () => {
    try {
      const res = await api.get('/warga')
      setWargaList(res.data)
    } catch (error) {
      console.error('Error fetching warga:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredWarga = wargaList.filter(w => 
    w.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.user?.nomorKK?.includes(searchTerm)
  )

  const handleSelectWarga = (id) => {
    setSelectedWarga(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedWarga.length === filteredWarga.length) {
      setSelectedWarga([])
    } else {
      setSelectedWarga(filteredWarga.map(w => w.id))
    }
  }

  const handleSendReminder = async () => {
    if (selectedWarga.length === 0) {
      showAlert('Pilih minimal satu warga')
      return
    }

    if (!await showConfirm(`Kirim pengingat tagihan ke ${selectedWarga.length} warga?`)) return

    setSending(true)
    try {
      const res = await api.post('/notifications/send-reminder', {
        wargaIds: selectedWarga,
        bulan: reminderData.bulan,
        tahun: reminderData.tahun,
        message: reminderData.message || null
      })
      showAlert(res.data.message)
      setSelectedWarga([])
    } catch (error) {
      showAlert(error.response?.data?.error || 'Gagal mengirim pengingat')
    } finally {
      setSending(false)
    }
  }

  const handleSendToUnpaid = async () => {
    if (!await showConfirm(`Kirim pengingat ke semua warga yang belum bayar bulan ${getBulanName(reminderData.bulan)} ${reminderData.tahun}?`)) return

    setSending(true)
    try {
      const res = await api.post('/notifications/send-reminder-unpaid', {
        bulan: reminderData.bulan,
        tahun: reminderData.tahun,
        message: reminderData.message || null
      })
      showAlert(res.data.message)
    } catch (error) {
      showAlert(error.response?.data?.error || 'Gagal mengirim pengingat')
    } finally {
      setSending(false)
    }
  }

  const handleSendCustom = async () => {
    if (!customData.title || !customData.message) {
      showAlert('Judul dan pesan wajib diisi')
      return
    }

    if (!customData.sendToAll && selectedWarga.length === 0) {
      showAlert('Pilih minimal satu warga atau centang "Kirim ke Semua Warga"')
      return
    }

    const targetCount = customData.sendToAll ? wargaList.length : selectedWarga.length
    if (!await showConfirm(`Kirim notifikasi ke ${targetCount} warga?`)) return

    setSending(true)
    try {
      const res = await api.post('/notifications/send-custom', {
        wargaIds: customData.sendToAll ? [] : selectedWarga,
        title: customData.title,
        message: customData.message,
        sendToAll: customData.sendToAll
      })
      showAlert(res.data.message)
      setSelectedWarga([])
      setCustomData({ title: '', message: '', sendToAll: false })
    } catch (error) {
      showAlert(error.response?.data?.error || 'Gagal mengirim notifikasi')
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminLayout title="Kirim Notifikasi">
      <div className="space-y-6">
        {/* Tab Selector */}
        <div className="bg-white border-4 border-black neubrutal-shadow">
          <div className="flex border-b-4 border-black">
            <button
              onClick={() => setActiveTab('reminder')}
              className={`flex-1 p-4 font-label-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'reminder' ? 'bg-primary text-white' : 'bg-white hover:bg-zinc-100'
              }`}
            >
              <span className="material-symbols-outlined">notifications_active</span>
              Pengingat Tagihan
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 p-4 font-label-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors border-l-4 border-black ${
                activeTab === 'custom' ? 'bg-secondary text-white' : 'bg-white hover:bg-zinc-100'
              }`}
            >
              <span className="material-symbols-outlined">edit_notifications</span>
              Notifikasi Custom
            </button>
          </div>

          <div className="p-4 md:p-6">
            {activeTab === 'reminder' ? (
              <div className="space-y-4">
                <h3 className="font-headline-md uppercase">Pengingat Tagihan Iuran</h3>
                <p className="text-sm text-zinc-600">Kirim pengingat pembayaran iuran ke warga yang dipilih atau semua warga yang belum bayar.</p>

                {/* Periode Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label-bold uppercase text-xs mb-2">Bulan</label>
                    <select
                      value={reminderData.bulan}
                      onChange={(e) => setReminderData({ ...reminderData, bulan: parseInt(e.target.value) })}
                      className="w-full border-2 border-black p-3"
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{getBulanName(i + 1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase text-xs mb-2">Tahun</label>
                    <select
                      value={reminderData.tahun}
                      onChange={(e) => setReminderData({ ...reminderData, tahun: parseInt(e.target.value) })}
                      className="w-full border-2 border-black p-3"
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block font-label-bold uppercase text-xs mb-2">Pesan Custom (Opsional)</label>
                  <textarea
                    value={reminderData.message}
                    onChange={(e) => setReminderData({ ...reminderData, message: e.target.value })}
                    placeholder={`Pengingat: Tagihan iuran bulan ${getBulanName(reminderData.bulan)} ${reminderData.tahun} belum dibayar. Mohon segera melakukan pembayaran.`}
                    className="w-full border-2 border-black p-3 h-24 resize-none"
                  />
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSendToUnpaid}
                    disabled={sending}
                    className="flex-1 min-w-[200px] bg-error text-white border-4 border-black p-3 font-label-bold uppercase text-sm neubrutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">warning</span>
                    Kirim ke Semua Belum Bayar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-headline-md uppercase">Notifikasi Custom</h3>
                <p className="text-sm text-zinc-600">Kirim notifikasi dengan judul dan pesan custom ke warga.</p>

                <div>
                  <label className="block font-label-bold uppercase text-xs mb-2">Judul Notifikasi *</label>
                  <input
                    type="text"
                    value={customData.title}
                    onChange={(e) => setCustomData({ ...customData, title: e.target.value })}
                    placeholder="Contoh: Pengumuman Penting"
                    className="w-full border-2 border-black p-3"
                  />
                </div>

                <div>
                  <label className="block font-label-bold uppercase text-xs mb-2">Pesan *</label>
                  <textarea
                    value={customData.message}
                    onChange={(e) => setCustomData({ ...customData, message: e.target.value })}
                    placeholder="Tulis pesan notifikasi..."
                    className="w-full border-2 border-black p-3 h-32 resize-none"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customData.sendToAll}
                    onChange={(e) => setCustomData({ ...customData, sendToAll: e.target.checked })}
                    className="w-5 h-5 border-2 border-black"
                  />
                  <span className="font-label-bold uppercase text-sm">Kirim ke Semua Warga</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Warga Selection */}
        {((activeTab === 'reminder') || (activeTab === 'custom' && !customData.sendToAll)) && (
          <div className="bg-white border-4 border-black neubrutal-shadow">
            <div className="border-b-4 border-black p-4 bg-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">group</span>
                <h3 className="font-headline-md uppercase">Pilih Warga</h3>
                <span className="bg-primary text-white px-2 py-1 text-xs font-bold">{selectedWarga.length} dipilih</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama/No KK..."
                  className="border-2 border-black p-2 text-sm w-48"
                />
                <button
                  onClick={handleSelectAll}
                  className="bg-zinc-200 border-2 border-black px-3 py-2 text-sm font-label-bold uppercase hover:bg-zinc-300 transition-colors"
                >
                  {selectedWarga.length === filteredWarga.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                </div>
              ) : filteredWarga.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">Tidak ada warga ditemukan</div>
              ) : (
                <div className="divide-y-2 divide-black">
                  {filteredWarga.map(warga => (
                    <label
                      key={warga.id}
                      className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-zinc-50 transition-colors ${
                        selectedWarga.includes(warga.id) ? 'bg-primary-container' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWarga.includes(warga.id)}
                        onChange={() => handleSelectWarga(warga.id)}
                        className="w-5 h-5 border-2 border-black"
                      />
                      <div className="flex-1">
                        <div className="font-label-bold">{warga.user?.nama}</div>
                        <div className="text-xs text-zinc-500">No KK: {warga.user?.nomorKK || '-'}</div>
                      </div>
                      <div className="text-xs text-zinc-500">{warga.alamat || '-'}</div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Send Button */}
        <div className="flex justify-end">
          <button
            onClick={activeTab === 'reminder' ? handleSendReminder : handleSendCustom}
            disabled={sending || (activeTab === 'reminder' && selectedWarga.length === 0) || (activeTab === 'custom' && !customData.sendToAll && selectedWarga.length === 0)}
            className="bg-primary text-white border-4 border-black px-8 py-4 font-label-bold uppercase neubrutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Mengirim...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">send</span>
                Kirim {activeTab === 'reminder' ? 'Pengingat' : 'Notifikasi'}
              </>
            )}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
