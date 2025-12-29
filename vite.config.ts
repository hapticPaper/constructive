import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

function githubPages404(base: string): Plugin {
  let config: ResolvedConfig | null = null;

  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  return {
    name: 'constructive-github-pages-404',
    apply: 'build',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async closeBundle() {
      if (!config) return;

      const outDir = config.build.outDir;
      const file = path.join(outDir, '404.html');

      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Constructive</title>
  </head>
  <body>
    <script>
      (function () {
        var l = window.location;
        var base = ${JSON.stringify(normalizedBase)};

        var rel = l.pathname.startsWith(base) ? l.pathname.slice(base.length - 1) : l.pathname;
        var target = rel + l.search + l.hash;

        l.replace(base + '?_redirect=' + encodeURIComponent(target));
      })();
    </script>
  </body>
</html>
`;

      await writeFile(file, html, 'utf8');
    },
  };
}

export default defineConfig(() => {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isPages = process.env.GITHUB_PAGES === 'true';

  const isUserOrOrgPages = Boolean(repo && repo.endsWith('.github.io'));
  const base = isPages && repo && !isUserOrOrgPages ? `/${repo}/` : '/';

  return {
    base,
    plugins: [
      // MDX needs to run before React.
      mdx({ providerImportSource: '@mdx-js/react' }),
      react(),
      githubPages404(base),
    ],
  };
});
