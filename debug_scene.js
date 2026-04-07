import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const children = await page.evaluate(() => {
      const scene = window.game.scene.getScene('CombatScene');
      if (!scene) return 'No CombatScene';
      return scene.children.list.map(c => ({
        type: c.type || c.constructor.name,
        x: c.x,
        y: c.y,
        visible: c.visible,
        alpha: c.alpha,
        scale: c.scaleX,
        text: c.text,
        depth: c.depth
      }));
    });
    
    console.log(JSON.stringify(children, null, 2));
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();