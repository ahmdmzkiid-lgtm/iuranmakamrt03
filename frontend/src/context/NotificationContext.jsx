import React, { createContext, useContext, useState } from 'react'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null) // { message, type: 'alert' | 'confirm', onConfirm, onCancel, title }

  const showAlert = (message, title = 'Notifikasi') => {
    return new Promise((resolve) => {
      setNotification({
        title,
        message,
        type: 'alert',
        onConfirm: () => {
          setNotification(null)
          resolve()
        }
      })
    })
  }

  const showConfirm = (message, title = 'Konfirmasi') => {
    return new Promise((resolve) => {
      setNotification({
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          setNotification(null)
          resolve(true)
        },
        onCancel: () => {
          setNotification(null)
          resolve(false)
        }
      })
    })
  }

  return (
    <NotificationContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {notification && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className={`p-4 border-b-4 border-black flex items-center gap-3 ${notification.type === 'confirm' ? 'bg-secondary-container' : 'bg-primary-container text-white'}`}>
              <span className="material-symbols-outlined font-bold">
                {notification.type === 'confirm' ? 'help' : 'info'}
              </span>
              <h2 className="font-display-bold text-lg uppercase tracking-wider">
                {notification.title}
              </h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="font-body-lg text-zinc-800 leading-relaxed">
                {notification.message}
              </p>
            </div>
            
            {/* Actions */}
            <div className="p-4 bg-zinc-50 border-t-4 border-black flex justify-end gap-4">
              {notification.type === 'confirm' && (
                <button 
                  onClick={notification.onCancel}
                  className="px-6 py-2 border-4 border-black font-label-bold uppercase hover:bg-zinc-200 transition-all active-press"
                >
                  Batal
                </button>
              )}
              <button 
                onClick={notification.onConfirm}
                className="px-8 py-2 bg-primary text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press"
              >
                {notification.type === 'confirm' ? 'Ya, Lanjutkan' : 'Mengerti'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}

export const useNotification = () => useContext(NotificationContext)
