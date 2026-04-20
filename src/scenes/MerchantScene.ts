// ABOUTME: Full-screen merchant presentation. Owns rendering + input; delegates all shop state to MerchantShop.
// ABOUTME: Design brief: calm readable shop. No camera sway, no idle tile tweens, gold always visible, hover is subtle.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { MerchantShop, type ShopItem } from '../shop/MerchantShop';
import { createRunRng } from '../run/rng';
import { enterBodyScene, exitBodyScene } from './bodySceneHelpers';

interface TileRefs {
  container: Phaser.GameObjects.Container;
  priceText: Phaser.GameObjects.Text;
  labelText: Phaser.GameObjects.Text;
  width: number;
  height: number;
  paidStamp?: Phaser.GameObjects.Container;
}

export class MerchantScene extends Phaser.Scene {
  private runState!: RunState;
  private shop!: MerchantShop;
  private goldText!: Phaser.GameObjects.Text;
  private tiles: TileRefs[] = [];

  constructor() { super('MerchantScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.shop = new MerchantShop(this.runState, createRunRng(Date.now()));
  }

  preload(): void {
    this.load.image('merchant_shop_bg', 'assets/merchant-v2/shop_bg.png');
    this.load.image('merchant_portrait', 'assets/merchant-v2/merchant_npc.png');
    this.load.image('icon_card', 'assets/merchant-v2/icon_card.png');
    this.load.image('icon_relic', 'assets/merchant-v2/icon_relic.png');
    this.load.image('icon_potion', 'assets/merchant-v2/icon_potion.png');
    this.load.image('icon_service', 'assets/merchant-v2/icon_service.png');
  }

  create(): void {
    enterBodyScene(this);
    this.drawBackground();
    this.drawMerchant();
    this.drawHeader();
    this.drawItems();
    this.drawLeaveButton();
    this.refresh();

    // Scene-entry ambience — soft scroll unfurl blends with the fade-in.
    this.sound.play('map-scroll-unfurl', { volume: 0.45 });
  }

  private drawBackground(): void {
    // Opaque shop interior covers the full canvas. No camera sway, no looping tween.
    const bg = this.add.image(640, 360, 'merchant_shop_bg').setOrigin(0.5);
    const sx = 1280 / bg.width;
    const sy = 720 / bg.height;
    bg.setScale(Math.max(sx, sy));

    // Warm lamp glow from the overhead lantern — casts a soft amber pool over the counter
    // where the items sit. Gives the scene a light source instead of flat uniform lighting.
    const glow = this.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 5; i++) {
      const r = 280 - i * 40;
      glow.fillStyle(0xffcc66, 0.05 + i * 0.02);
      glow.fillCircle(640, 200, r);
    }
    this.tweens.add({
      targets: glow, alpha: 0.85, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private drawMerchant(): void {
    // Portrait medallion tucked into the bottom-left, clear of the item grid.
    const cx = 95;
    const cy = 662;
    const r = 75;

    this.add.ellipse(cx, cy + r - 4, r * 2 - 14, 12, 0x000000, 0.4);

    // Hand-inked-feel ring: three slightly offset strokes with variable weight.
    const ring = this.add.graphics();
    ring.lineStyle(5, 0xc89b3c, 1);
    ring.strokeCircle(cx + 1, cy, r);
    ring.lineStyle(3, 0x8a5a1c, 0.85);
    ring.strokeCircle(cx - 1, cy + 1, r);
    ring.lineStyle(2, 0x3a2418, 0.7);
    ring.strokeCircle(cx, cy, r + 6);

    const npc = this.add.image(cx, cy, 'merchant_portrait').setOrigin(0.5).setScale(0.19);
    this.tweens.add({ targets: npc, scale: 0.195, duration: 3500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Merchant's voice: a greeting bubble that drifts in after the scroll-unfurl, then fades.
    const greetings = [
      '"Welcome, traveler."',
      '"Mind the coin purse."',
      '"A keen eye today, hmm?"',
      '"Wares for the road ahead."',
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)]!;
    this.showSpeechBubble(cx + r + 30, cy - r + 20, greeting);
  }

  private showSpeechBubble(x: number, y: number, text: string): void {
    const bubble = this.add.container(x, y).setAlpha(0);
    const bg = this.add.graphics();
    const padX = 14, padY = 10;
    const t = this.add.text(0, 0, text, {
      fontSize: '15px', fontStyle: 'italic', color: '#3a2418', align: 'left',
    }).setOrigin(0, 0.5);
    const w = t.width + padX * 2;
    const h = t.height + padY * 2;
    bg.fillStyle(0xf4e8c5, 0.96);
    bg.fillRoundedRect(-padX, -h / 2, w, h, 8);
    bg.lineStyle(2, 0x8a5a1c, 0.9);
    bg.strokeRoundedRect(-padX, -h / 2, w, h, 8);
    // Little tail pointing down-left toward the merchant.
    bg.fillTriangle(-6, h / 2 - 2, -20, h / 2 + 12, 4, h / 2 - 2);
    bg.lineBetween(-6, h / 2 - 2, -20, h / 2 + 12);
    bg.lineBetween(-20, h / 2 + 12, 4, h / 2 - 2);
    bubble.add(bg);
    bubble.add(t);
    this.tweens.add({
      targets: bubble, alpha: 1, y: y - 6, duration: 600, ease: 'Sine.easeOut', delay: 700,
    });
    this.tweens.add({
      targets: bubble, alpha: 0, duration: 800, ease: 'Sine.easeIn', delay: 4200,
      onComplete: () => bubble.destroy(),
    });
  }

  private drawHeader(): void {
    // Wooden plank header — hand-drawn via Graphics so it stays crisp at all zoom levels.
    // Warm oak plank with gold-trim border and corner flourishes.
    const plank = this.add.graphics();
    // Drop shadow
    plank.fillStyle(0x000000, 0.35);
    plank.fillRoundedRect(42, 66, 1196, 68, 8);
    // Main plank body (warm oak gradient feel via two layered fills)
    plank.fillStyle(0x5c3a1e, 1);
    plank.fillRoundedRect(40, 60, 1200, 68, 8);
    plank.fillStyle(0x7a4f2a, 1);
    plank.fillRoundedRect(44, 64, 1192, 60, 6);
    // Wood grain lines
    plank.lineStyle(1, 0x3a2418, 0.35);
    [78, 94, 110].forEach(y => {
      plank.lineBetween(60, y, 1220, y);
    });
    // Gold trim
    plank.lineStyle(2, 0xc89b3c, 0.9);
    plank.strokeRoundedRect(44, 64, 1192, 60, 6);
    // Corner flourishes (diamond studs)
    [70, 1210].forEach(x => {
      plank.fillStyle(0xc89b3c, 1);
      plank.fillCircle(x, 94, 4);
      plank.fillStyle(0x8a5a1c, 1);
      plank.fillCircle(x, 94, 2);
    });

    this.add.text(90, 94, 'Merchant', {
      fontSize: '30px', fontStyle: 'bold italic', color: '#efe5cc',
      shadow: { blur: 3, color: '#000', fill: true },
    }).setOrigin(0, 0.5);

    // Painted coin glyph next to the gold number.
    const coin = this.add.graphics();
    coin.fillStyle(0xc89b3c, 1);
    coin.fillCircle(1160, 94, 14);
    coin.lineStyle(2, 0x8a5a1c, 1);
    coin.strokeCircle(1160, 94, 14);
    this.add.text(1160, 94, 'G', {
      fontSize: '18px', fontStyle: 'bold', color: '#3a2418',
    }).setOrigin(0.5);

    this.goldText = this.add.text(1210, 94, '', {
      fontSize: '26px', fontStyle: 'bold', color: '#ffd700',
      shadow: { blur: 3, color: '#000', fill: true },
    }).setOrigin(1, 0.5);
  }

  private drawItems(): void {
    const view = this.shop.view();
    const tileW = 200;
    const tileH = 225;
    const gap = 16;
    const cols = 4;
    const gridW = cols * tileW + (cols - 1) * gap;
    const leftX = (1280 - gridW) / 2 + tileW / 2;
    const topY = 215;

    view.items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = leftX + col * (tileW + gap);
      const y = topY + row * (tileH + gap);
      this.tiles.push(this.drawItemTile(i, item, x, y, tileW, tileH));
    });
  }

  private drawItemTile(index: number, item: ShopItem, x: number, y: number, w: number, h: number): TileRefs {
    const container = this.add.container(x, y);
    const style = kindStyle(item.kind);

    // Two-layer drop shadow grounds the tile on the counter surface.
    container.add(this.add.ellipse(4, h / 2 + 6, w * 0.9, 18, 0x000000, 0.5));
    container.add(this.add.ellipse(0, h / 2 + 2, w * 0.85, 10, 0x000000, 0.35));

    // Body — cream parchment with a thick colored border that reads as "relic vs card vs potion".
    const bg = this.add.graphics();
    bg.fillStyle(style.bodyFill, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(3, style.border, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    container.add(bg);

    // Uniform circular backdrop for the painted icon so each kind's icon weighs the same visually.
    const iconCx = w / 2 - 28;
    const iconCy = -h / 2 + 30;
    const iconR = 22;
    const iconBg = this.add.graphics();
    iconBg.fillStyle(0xfff8e6, 0.85);
    iconBg.fillCircle(iconCx, iconCy, iconR);
    iconBg.lineStyle(1.5, style.border, 0.8);
    iconBg.strokeCircle(iconCx, iconCy, iconR);
    container.add(iconBg);

    // Painted icon — scale to fit within the backdrop circle uniformly.
    const icon = this.add.image(iconCx, iconCy, style.icon).setOrigin(0.5);
    const iconScale = 36 / Math.max(icon.width, icon.height);
    icon.setScale(iconScale);
    container.add(icon);

    // Rarity/kind tag in the top-left.
    container.add(this.add.text(-w / 2 + 14, -h / 2 + 20, kindLabel(item.kind, item.sub), {
      fontSize: '11px', fontStyle: 'bold italic', color: colorHex(style.border),
    }).setOrigin(0, 0.5));

    // Energy cost pip — only for cards. Blue "orb" on the left edge, StS-style.
    if (item.kind === 'card' && typeof item.cost === 'number') {
      const cx = -w / 2 + 14;
      const cy = -h / 2 + 62;
      const orb = this.add.graphics();
      orb.fillStyle(0x3a2418, 0.3); // subtle shadow
      orb.fillCircle(cx + 1, cy + 2, 15);
      orb.fillStyle(0x3d6fc4, 1);
      orb.fillCircle(cx, cy, 14);
      orb.fillStyle(0x6aa0e8, 0.6);
      orb.fillCircle(cx - 3, cy - 3, 5);
      orb.lineStyle(2, 0x1e3f7c, 0.9);
      orb.strokeCircle(cx, cy, 14);
      container.add(orb);
      container.add(this.add.text(cx, cy, String(item.cost), {
        fontSize: '16px', fontStyle: 'bold', color: '#efe5cc',
        shadow: { blur: 2, color: '#000', fill: true },
      }).setOrigin(0.5));
    }

    // Item title
    const labelText = this.add.text(0, -h / 2 + 52, item.label, {
      fontSize: '18px', fontStyle: 'bold', color: '#3a2418', align: 'center',
      wordWrap: { width: w - 24 },
    }).setOrigin(0.5, 0);
    container.add(labelText);

    // Description — what the item actually does.
    container.add(this.add.text(0, -h / 2 + 100, item.description, {
      fontSize: '13px', color: '#4a321c', align: 'center', lineSpacing: 3,
      wordWrap: { width: w - 20 },
    }).setOrigin(0.5, 0));

    // Divider above price
    const divider = this.add.graphics();
    divider.lineStyle(1, style.border, 0.5);
    divider.lineBetween(-w / 2 + 18, h / 2 - 44, w / 2 - 18, h / 2 - 44);
    container.add(divider);

    // Price
    const priceText = this.add.text(0, h / 2 - 22, '', {
      fontSize: '20px', fontStyle: 'bold', color: '#c89b3c', align: 'center',
    }).setOrigin(0.5);
    container.add(priceText);

    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.tryBuy(index));
    container.on('pointerover', () => {
      if (this.shop.canAfford(index)) {
        this.tweens.add({ targets: container, scale: 1.04, duration: 140, ease: 'Sine.easeOut' });
        this.sound.play('sfx_hover', { volume: 0.2 });
      }
    });
    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scale: 1.0, duration: 140, ease: 'Sine.easeOut' });
    });

    return { container, priceText, labelText, width: w, height: h };
  }

  private drawLeaveButton(): void {
    const btn = this.add.container(1170, 660);
    const bg = this.add.graphics();
    bg.fillStyle(0x3a2418, 1);
    bg.fillRoundedRect(-90, -24, 180, 48, 10);
    bg.lineStyle(2, 0xc89b3c, 1);
    bg.strokeRoundedRect(-90, -24, 180, 48, 10);
    btn.add(bg);
    btn.add(this.add.text(0, 0, 'Leave', {
      fontSize: '20px', fontStyle: 'bold', color: '#efe5cc', letterSpacing: 2,
    }).setOrigin(0.5));
    btn.setSize(180, 48).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      this.sound.play('sfx_button');
      this.leave();
    });
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 120 }));
  }

  private tryBuy(index: number): void {
    if (!this.shop.buy(index)) {
      const tile = this.tiles[index]?.container;
      if (tile) this.tweens.add({ targets: tile, x: tile.x + 6, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    this.sound.play('sfx_card_draw');
    this.refresh();
  }

  private leave(): void {
    exitBodyScene(this, this.runState, this.shop.computeLeaveOutcomes(), 'MAP');
  }

  private refresh(): void {
    const view = this.shop.view();
    this.goldText.setText(`${view.goldAvailable} gold`);
    view.items.forEach((item, i) => {
      const tile = this.tiles[i];
      if (!tile) return;
      const purchased = view.purchased.has(i);
      const affordable = this.shop.canAfford(i);
      const priceLabel = purchased ? 'SOLD' : `${item.price} G`;
      const priceColor = purchased ? '#6b4a2b' : affordable ? '#c89b3c' : '#a04040';
      // Destroy + recreate price text instead of mutating; Phaser 4 canvas text
      // crashes on setColor in some edge cases.
      const { x, y } = tile.priceText;
      tile.priceText.destroy();
      const fresh = this.add.text(x, y, priceLabel, {
        fontSize: purchased ? '22px' : '20px', fontStyle: 'bold', color: priceColor,
        align: 'center', letterSpacing: purchased ? 3 : 0,
      }).setOrigin(0.5);
      tile.container.add(fresh);
      tile.priceText = fresh;
      // Sold tiles: dim body + overlay a red wax "PAID" stamp so the purchase feels irrevocable.
      tile.container.setAlpha(purchased ? 0.55 : 1.0);
      tile.labelText.setColor(purchased ? '#8a7555' : '#3a2418');
      if (purchased) {
        tile.container.disableInteractive();
        if (!tile.paidStamp) tile.paidStamp = this.makePaidStamp(tile);
      }
    });
  }

  private makePaidStamp(tile: TileRefs): Phaser.GameObjects.Container {
    const stamp = this.add.container(0, -10);
    stamp.setRotation(-0.18);
    // Wax-seal ring
    const ring = this.add.graphics();
    ring.lineStyle(5, 0xaa2a22, 1);
    ring.strokeRoundedRect(-70, -28, 140, 56, 10);
    ring.lineStyle(3, 0x7c1915, 0.9);
    ring.strokeRoundedRect(-72, -30, 144, 60, 10);
    stamp.add(ring);
    stamp.add(this.add.text(0, 0, 'PAID', {
      fontSize: '32px', fontStyle: 'bold', color: '#aa2a22', letterSpacing: 4,
    }).setOrigin(0.5));
    stamp.setAlpha(1.7); // override parent's 0.55 dim so the stamp still reads
    tile.container.add(stamp);
    return stamp;
  }
}

function kindLabel(kind: ShopItem['kind'], sub: string): string {
  if (kind === 'remove') return 'SERVICE';
  return sub.toUpperCase();
}

interface KindStyle {
  border: number;
  bodyFill: number;
  icon: string;
}

function kindStyle(kind: ShopItem['kind']): KindStyle {
  // Unified parchment body; kind signal lives in the border accent + painted icon.
  // This keeps the palette disciplined (warm cream + one accent hue per tile) instead of
  // introducing violet/green/tan body tints that fight the painterly shop backdrop.
  const body = 0xf4e8c5;
  switch (kind) {
    case 'card':   return { border: 0x9a6a2c, bodyFill: body, icon: 'icon_card' };
    case 'relic':  return { border: 0x6a4c7c, bodyFill: body, icon: 'icon_relic' };
    case 'potion': return { border: 0x4a7a4c, bodyFill: body, icon: 'icon_potion' };
    case 'remove': return { border: 0x7a5a3c, bodyFill: body, icon: 'icon_service' };
  }
}

function colorHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
