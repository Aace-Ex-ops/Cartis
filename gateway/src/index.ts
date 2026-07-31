import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ status: 'ok', service: 'cartis-gateway' }))

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
