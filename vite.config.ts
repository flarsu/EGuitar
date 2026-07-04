import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base './' + singlefile: `npm run build` emits one self-contained dist/index.html
// that runs from file:// on any OS, or hosted under any subpath.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
})
