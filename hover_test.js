import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Give it a moment to render phaser and do the draw animation
    await new Promise(r => setTimeout(r, 2000));
    
    // Hover over the center of the hand
    await page.mouse.move(640, 680);
    
    // Wait for the hover tween to finish
    await new Promise(r => setTimeout(r, 500));

    const base64 = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? canvas.toDataURL('image/png').split(',')[1] : null;
    });
    
    if (base64) {
      fs.writeFileSync('hover_snapshot.png', base64, 'base64');
      console.log('Saved hover_snapshot.png');
    }
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();