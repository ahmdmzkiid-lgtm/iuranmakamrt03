import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useNotification } from '../context/NotificationContext'

export default function Login() {
  const [nomorKK, setNomorKK] = useState('')
  const [password, setPassword] = useState('')
  const [activeMode, setActiveMode] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { showAlert } = useNotification()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activeMode) {
      showAlert('Silakan pilih mode login (ADMIN atau WARGA) di bawah')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { identifier: nomorKK, password })
      
      // Validasi Role sesuai mode yang dipilih
      if (res.data.role !== activeMode) {
        showAlert(`Login Gagal: Akun Anda bukan akun ${activeMode.toUpperCase()}`)
        setLoading(false)
        return
      }

      localStorage.setItem('token', res.data.token)
      localStorage.setItem('role', res.data.role)
      localStorage.setItem('nama', res.data.nama)
      localStorage.setItem('identifier', nomorKK)
      window.location.href = res.data.role === 'admin' ? '/admin' : '/warga'
    } catch (err) {
      console.error(err)
      showAlert(err.response?.data?.message || 'Nomor KK atau Password salah')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background min-h-screen flex text-on-surface font-body-md font-medium">
      <main className="flex w-full min-h-screen flex-col md:flex-row">
        <div className="bg-surface-container-low flex items-center justify-center p-md md:p-xl relative w-full min-h-screen">
          <div className="w-full max-w-md bg-surface-container-lowest neubrutalist-border neubrutalist-shadow p-4 md:p-gutter flex flex-col gap-4 md:gap-gutter z-10 relative">
            <div className="flex flex-col gap-sm border-b-4 border-black pb-md items-center text-center">
              <h2 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">
                Selamat Datang!
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant uppercase font-bold">
                Warga RT 03
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-md">
              <div className="flex flex-col gap-unit">
                <label
                  className="font-label-bold text-label-bold text-on-surface uppercase"
                  htmlFor="nomorKK"
                >
                  NOMOR KK
                </label>
                <input
                  id="nomorKK"
                  type="text"
                  placeholder="Masukkan nomor KK"
                  className="neubrutalist-border p-sm bg-surface-container-lowest focus:bg-tertiary-fixed focus:border-primary focus:ring-0 focus:outline-none font-body-lg text-body-lg text-on-surface transition-colors w-full"
                  value={nomorKK}
                  onChange={(e) => setNomorKK(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-unit">
                <div className="flex justify-between items-end">
                  <label
                    className="font-label-bold text-label-bold text-on-surface uppercase"
                    htmlFor="password"
                  >
                    PASSWORD
                  </label>
                  <a
                    className="font-label-bold text-label-bold text-primary hover:text-on-surface underline decoration-2 underline-offset-2 uppercase"
                    href="https://wa.me/6282123576579?text=LUPA%20KATA%20SANDI%0ANAMA%3A%0ANO%20KK%3A"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Lupa Kata Sandi
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="Masukkan kata sandi"
                  className="neubrutalist-border p-sm bg-surface-container-lowest focus:bg-tertiary-fixed focus:border-primary focus:ring-0 focus:outline-none font-body-lg text-body-lg text-on-surface transition-colors w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-xs mt-unit">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-6 h-6 neubrutalist-border text-primary focus:ring-0 focus:ring-offset-0 bg-surface-container-lowest cursor-pointer rounded-none"
                />
                <label
                  className="font-label-bold text-label-bold text-on-surface uppercase cursor-pointer select-none"
                  htmlFor="remember"
                >
                  Ingat Saya
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-tertiary-fixed neubrutalist-border neubrutalist-shadow-sm p-sm font-headline-md text-headline-md text-on-tertiary-fixed uppercase neubrutalist-button transition-all mt-sm flex justify-center items-center gap-xs"
              >
                MASUK
                <span className="material-symbols-outlined">login</span>
              </button>
            </form>
            <div className="border-t-4 border-black pt-md flex gap-sm mt-sm">
              <button
                className={`flex-1 neubrutalist-border p-xs font-black uppercase transition-all ${
                  activeMode === 'admin'
                    ? 'bg-primary text-white neubrutalist-shadow-sm translate-x-1 translate-y-1'
                    : 'bg-white text-black opacity-60 hover:opacity-100'
                }`}
                type="button"
                onClick={() => {
                  setActiveMode('admin')
                  setNomorKK('')
                  setPassword('')
                }}
              >
                LOGIN ADMIN
              </button>
              <button
                className={`flex-1 neubrutalist-border p-xs font-black uppercase transition-all ${
                  activeMode === 'warga'
                    ? 'bg-primary text-white neubrutalist-shadow-sm translate-x-1 translate-y-1'
                    : 'bg-white text-black opacity-60 hover:opacity-100'
                }`}
                type="button"
                onClick={() => {
                  setActiveMode('warga')
                  setNomorKK('')
                  setPassword('')
                }}
              >
                LOGIN WARGA
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
