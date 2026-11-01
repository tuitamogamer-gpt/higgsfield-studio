import { createApp } from '../server/index.js'

// Static assets are served by Vercel's CDN; only /api routes enter this function.
export default createApp({ serveStatic: false })
