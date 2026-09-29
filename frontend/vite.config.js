import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During local development, forward API calls to the Flask backend
    proxy: {
      '/todos': 'http://127.0.0.1:5000',
    },
  },
})
