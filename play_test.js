import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Try to drag the center card (around x=640, y=600) to the enemy (x=950, y=400)
  await page.mouse.move(640, 600);
  await page.mouse.down();
  await page.mouse.move(640, 500, { steps: 10 });
  await page.mouse.move(950, 400, { steps: 10 });
  
  // Take screenshot while dragging
  await page.screenshot({ path: 'dragging.png' });
  
  await page.mouse.up();
  
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'after_drag.png' });
  
  await browser.close();
})();