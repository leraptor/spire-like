import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    // Give it a moment to render phaser
    await new Promise(r => setTimeout(r, 2000));
    
    const base64 = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? canvas.toDataURL('image/png').split(',')[1] : null;
    });
    
    if (base64) {
      fs.writeFileSync('snapshot.png', base64, 'base64');
      console.log('Saved snapshot.png');
    } else {
      console.log('No canvas found.');
    }
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();