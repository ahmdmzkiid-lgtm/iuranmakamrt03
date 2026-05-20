import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'
import WargaLayout from '../../components/warga/WargaLayout'

export default function UbahPassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const navigate = useNavigate()
  const { showAlert } = useNotification()

  useEffect(() => {
    const firstLogin = localStorage.getItem('isFirstLogin') === 'true'
    setIsFirstLogin(firstLogin)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (newPassword.length < 6) {
      showAlert('Password baru minimal 6 karakter')
      return
    }

    if (newPassword !== confirmPassword) {
      showAlert('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      const payload = { newPassword }
      if (!isFirstLogin) {
        payload.currentPassword = currentPassword
      }

      await api.post('/auth/change-password', payload)
      
      // Set flag to show user guide on next dashboard load if this is first login
      if (isFirstLogin) {
        localStorage.setItem('showUserGuide', 'true')
      }
      
      // Clear first login flag
      localStorage.removeItem('isFirstLogin')
      
      showAlert('Password berhasil diubah!')
      
      // Redirect to dashboard after success
      setTimeout(() => {
        navigate('/warga')
      }, 1500)
    } catch (err) {
      console.error(err)
      showAlert(err.response?.data?.message || 'Gagal mengubah password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <WargaLayout>
      <div className="max-w-lg mx-auto">
        <div className="bg-white border-4 border-black neubrutal-shadow overflow-hidden">
          <div className="p-4 md:p-6 border-b-4 border-black bg-tertiary-fixed">
            <h1 className="font-display-bold text-xl md:text-2xl uppercase flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl">lock</span>
              {isFirstLogin ? 'Buat Password Baru' : 'Ubah Password'}
            </h1>
          </div>
          
          <div className="p-4 md:p-6">
            {isFirstLogin && (
              <div className="bg-primary-container border-2 border-black p-4 mb-6">
                <p className="font-body-md text-white text-sm">
                  <span className="font-bold">Selamat datang!</span> Ini adalah login pertama Anda. 
                  Silakan buat password baru untuk keamanan akun Anda.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isFirstLogin && (
                <div>
                  <label className="block font-label-bold uppercase mb-2 text-sm">
                    Password Lama
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border-4 border-black p-3 font-bold focus:ring-0 outline-none focus:bg-tertiary-fixed/20"
                    placeholder="Masukkan password lama"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-label-bold uppercase mb-2 text-sm">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border-4 border-black p-3 font-bold focus:ring-0 outline-none focus:bg-tertiary-fixed/20"
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block font-label-bold uppercase mb-2 text-sm">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border-4 border-black p-3 font-bold focus:ring-0 outline-none focus:bg-tertiary-fixed/20"
                  placeholder="Ulangi password baru"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                {!isFirstLogin && (
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex-1 bg-white border-4 border-black p-3 font-headline-md uppercase neubrutal-shadow active-press"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 bg-primary text-white border-4 border-black p-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center justify-center gap-2 ${loading ? 'opacity-70' : ''}`}
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">save</span>
                      Simpan Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </WargaLayout>
  )
}
