import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    const data = await res.json();
    const browser = await puppeteer.connect({ browserWSEndpoint: data.webSocketDebuggerUrl });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('3001'));
    if (page) {
      await page.waitForSelector('canvas');
      const base64 = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return canvas ? canvas.toDataURL('image/png').split(',')[1] : null;
      });
      if (base64) {
        fs.writeFileSync('phaser/spire-like/debug_snapshot.png', base64, 'base64');
        console.log('Saved snapshot!');
      } else {
        console.log('No canvas found.');
      }
    } else {
      console.log('Page not found.');
    }
    browser.disconnect();
  } catch (err) {
    console.error(err);
  }
})();