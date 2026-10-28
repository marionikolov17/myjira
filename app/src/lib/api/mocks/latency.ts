const MIN_LATENCY_MS = 150
const MAX_LATENCY_MS = 400

export function simulateLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)
  return new Promise((resolve) => setTimeout(resolve, delay))
}
