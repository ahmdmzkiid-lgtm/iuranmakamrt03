import webpush from 'web-push'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// VAPID keys - simpan di .env untuk production
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BExD9O_AXBRSOcD2JedL9FFHtMJ0pg47a0_kg9R6CQs5D4Gl4Aj9ZsxTfzbxuRY5Lu4xnuNqEaM'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'LaVjB5TSlwBsU99TLRHzPmBsp6fhP4f3kB6_'

webpush.setVapidDetails(
  'mailto:admin@iuranrt03.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

export const sendPushNotification = async (userId, title, message, url = '/warga') => {
  try {
    // Get user's push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    })

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`)
      return { success: false, reason: 'no_subscription' }
    }

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      url,
      timestamp: Date.now()
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }, payload)
          return { success: true, subscriptionId: sub.id }
        } catch (error) {
          // If subscription is expired or invalid, delete it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } })
            console.log(`Deleted expired subscription ${sub.id}`)
          }
          throw error
        }
      })
    )

    const successCount = results.filter(r => r.status === 'fulfilled').length
    return { success: successCount > 0, sent: successCount, total: subscriptions.length }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return { success: false, error: error.message }
  }
}

export const sendPushToMultipleUsers = async (userIds, title, message, url = '/warga') => {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, title, message, url))
  )
  
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  return { sent: successCount, total: userIds.length }
}

export { VAPID_PUBLIC_KEY }
