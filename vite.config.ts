import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isPages = process.env.GITHUB_PAGES === 'true';

  return {
    base: isPages && repo ? `/${repo}/` : '/',
    plugins: [
      // MDX needs to run before React.
      mdx(),
      react(),
    ],
  };
});
