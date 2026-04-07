const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function removeBackground(file, isCheckerboard) {
    const image = await loadImage(file);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (isCheckerboard) {
            // Fake checkerboard is usually around grey 204 (ccc) or 255 (fff)
            if ((r > 190 && g > 190 && b > 190) || (r > 140 && g > 140 && b > 140 && r === g && g === b) || (r > 250 && g > 250 && b > 250)) {
                // Not a perfect chroma key, but simple distance check from greys
                const diff1 = Math.abs(r-204) + Math.abs(g-204) + Math.abs(b-204);
                const diff2 = Math.abs(r-255) + Math.abs(g-255) + Math.abs(b-255);
                const diff3 = Math.abs(r-153) + Math.abs(g-153) + Math.abs(b-153);
                if (diff1 < 30 || diff2 < 30 || diff3 < 30) {
                     data[i + 3] = 0; // transparent
                }
            }
        } else {
            // Black background
            if (r < 30 && g < 30 && b < 30) {
                data[i + 3] = 0; // transparent
            }
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
    const out = fs.createWriteStream(file);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('Fixed ' + file));
}

(async () => {
    await removeBackground('public/assets/player.png', true);
    await removeBackground('public/assets/enemy.png', false);
})();