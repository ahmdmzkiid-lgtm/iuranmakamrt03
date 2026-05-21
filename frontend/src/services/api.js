import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname !== '/') {
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        localStorage.removeItem('nama')
        localStorage.removeItem('isFirstLogin')
        window.location.href = '/'
      }
    }
    return Promise.reject(error)
  }
)

export default api
