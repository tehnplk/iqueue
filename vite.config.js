import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import electron from 'electron'

const PORT = 5173

export default defineConfig({
  base: './',
  server: { port: PORT, strictPort: true },
  plugins: [
    react(),
    {
      name: 'electron-dev',
      apply: 'serve',
      configureServer(server) {
        server.httpServer.once('listening', () => {
          const env = { ...process.env, VITE_DEV_URL: `http://localhost:${PORT}` }
          delete env.ELECTRON_RUN_AS_NODE // set by VSCode terminals; makes Electron act as plain Node
          spawn(electron, ['.'], { stdio: 'inherit', env }).on('exit', () => process.exit())
        })
      },
    },
  ],
})
