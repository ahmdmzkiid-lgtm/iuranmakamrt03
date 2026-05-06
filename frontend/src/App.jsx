import { Routes, Route } from 'react-router-dom'
import { NotificationProvider } from './context/NotificationContext'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminWarga from './pages/admin/Warga'
import AdminMakam from './pages/admin/Makam'
import AdminIuran from './pages/admin/Iuran'
import AdminLaporan from './pages/admin/Laporan'
import WargaDashboard from './pages/warga/Dashboard'
import WargaTagihan from './pages/warga/Tagihan'
import WargaKuitansi from './pages/warga/Kuitansi'
import WargaSetelan from './pages/warga/Setelan'
import WargaMakam from './pages/warga/Makam'
import WargaRiwayat from './pages/warga/Riwayat'
import AdminSetelan from './pages/admin/Setelan'

function App() {
  return (
    <NotificationProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/warga" element={<AdminWarga />} />
        <Route path="/admin/makam" element={<AdminMakam />} />
        <Route path="/admin/iuran" element={<AdminIuran />} />
        <Route path="/admin/laporan" element={<AdminLaporan />} />
        <Route path="/admin/setelan" element={<AdminSetelan />} />
        <Route path="/warga" element={<WargaDashboard />} />
        <Route path="/warga/tagihan" element={<WargaTagihan />} />
        <Route path="/warga/riwayat" element={<WargaRiwayat />} />
        <Route path="/warga/makam" element={<WargaMakam />} />
        <Route path="/warga/kuitansi" element={<WargaKuitansi />} />
        <Route path="/warga/setelan" element={<WargaSetelan />} />
      </Routes>
    </NotificationProvider>
  )
}

export default App
