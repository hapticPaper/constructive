import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_ROOT = path.resolve(process.cwd(), 'content', 'platforms');
const DIST_ROOT = path.resolve(process.cwd(), 'dist');

async function ensureHtmlAt(relativePath: string, html: string): Promise<void> {
  const filePath = path.join(DIST_ROOT, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, html, 'utf8');
}

async function listDirs(dirPath: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry);
    try {
      const s = await stat(full);
      if (s.isDirectory()) out.push(entry);
    } catch {
      // ignore
    }
  }

  return out.sort();
}

async function main(): Promise<void> {
  const indexHtmlPath = path.join(DIST_ROOT, 'index.html');
  const indexHtml = await readFile(indexHtmlPath, 'utf8');

  await ensureHtmlAt(path.join('library', 'index.html'), indexHtml);

  for (const platform of await listDirs(CONTENT_ROOT)) {
    const videosRoot = path.join(CONTENT_ROOT, platform, 'videos');
    for (const videoId of await listDirs(videosRoot)) {
      await ensureHtmlAt(path.join('video', platform, videoId, 'index.html'), indexHtml);
    }
  }

  process.stdout.write('Generated static HTML entrypoints for deep links.\n');
}

await main();
