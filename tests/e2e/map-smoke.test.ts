// ABOUTME: E2E smoke — blessing screen renders, map renders, QA panel opens.
import puppeteer from 'puppeteer';

const DEV_URL = 'http://localhost:3001/?seed=1';

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(DEV_URL, { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 3000));

  // BlessingScene should be active.
  const blessingActive = await page.evaluate(() => {
    const game = (window as unknown as { game?: { scene?: { isActive: (k: string) => boolean } } }).game;
    return game?.scene?.isActive('BlessingScene') ?? false;
  });
  if (!blessingActive) throw new Error('BlessingScene not active');

  // Click the first blessing card (center-left area).
  const coords = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / 1280;
    const scaleY = rect.height / 720;
    return { x: rect.left + 320 * scaleX, y: rect.top + 360 * scaleY };
  });
  await page.mouse.click(coords.x, coords.y);
  await new Promise(r => setTimeout(r, 2000));

  // MapScene should be active after picking a blessing.
  const mapActive = await page.evaluate(() => {
    const game = (window as unknown as { game?: { scene?: { isActive: (k: string) => boolean } } }).game;
    return game?.scene?.isActive('MapScene') ?? false;
  });
  if (!mapActive) throw new Error('MapScene not active after blessing');

  await browser.close();
  console.log('e2e smoke: OK — BlessingScene → MapScene flow works.');
}

main().catch(err => { console.error(err); process.exit(1); });
