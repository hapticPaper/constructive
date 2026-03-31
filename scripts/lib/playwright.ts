import { chromium, type Page } from 'playwright';

export const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

// Using a non-headless-looking UA is important for TikTok endpoints that
// otherwise return empty bodies.
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  {
    viewport = DEFAULT_VIEWPORT,
    userAgent = DEFAULT_USER_AGENT,
  }: {
    viewport?: { width: number; height: number };
    userAgent?: string;
  } = {},
): Promise<T> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport,
    userAgent,
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}
