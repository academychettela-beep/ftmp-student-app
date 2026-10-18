import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: `base` must match your GitHub repo name so assets load correctly
// on GitHub Pages, e.g. if your repo is github.com/you/ftmp-student-app,
// keep base as '/ftmp-student-app/'. If you deploy to a custom domain or a
// username.github.io *root* repo, change base to '/'.
export default defineConfig({
  plugins: [react()],
  base: '/ftmp-student-app/',
});
