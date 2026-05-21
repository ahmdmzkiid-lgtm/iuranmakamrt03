export function verifyCron(req, res, next) {
  const userAgent = req.headers['user-agent'] || ''
  const cronKey = req.headers['x-cron-key']

  // 1. Verify User-Agent
  if (!userAgent.toLowerCase().includes('cron-job.org')) {
    return res.status(403).send("Forbidden")
  }

  // 2. Verify Custom API Key
  const expectedKey = process.env.CRON_KEY
  if (!expectedKey) {
    console.warn('Warning: CRON_KEY environment variable is not defined.')
    return res.status(500).send("Configuration Missing")
  }

  if (cronKey !== expectedKey) {
    return res.status(401).send("Unauthorized")
  }

  next()
}
