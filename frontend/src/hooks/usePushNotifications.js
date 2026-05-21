import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      checkSubscription()
    }
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error('Error checking subscription:', error)
    }
  }

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Push notifications tidak didukung di browser ini')
    }

    setLoading(true)
    try {
      // Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        throw new Error('Izin notifikasi ditolak')
      }

      // Get VAPID public key from server
      const { data: { publicKey } } = await api.get('/notifications/vapid-public-key')

      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4)
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      // Send subscription to server
      const subscriptionJson = subscription.toJSON()
      await api.post('/notifications/subscribe', {
        endpoint: subscriptionJson.endpoint,
        keys: subscriptionJson.keys
      })

      setIsSubscribed(true)
      return { success: true, message: 'Berhasil mengaktifkan notifikasi' }
    } catch (error) {
      console.error('Error subscribing to push:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe()

        // Notify server
        await api.post('/notifications/unsubscribe', {
          endpoint: subscription.endpoint
        })
      }

      setIsSubscribed(false)
      return { success: true, message: 'Berhasil menonaktifkan notifikasi' }
    } catch (error) {
      console.error('Error unsubscribing:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe
  }
}

export default usePushNotifications
