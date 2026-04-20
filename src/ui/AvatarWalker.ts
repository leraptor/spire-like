// ABOUTME: Player avatar sprite on the map. Walks along a Bézier curve between nodes.
// ABOUTME: Reuses the existing hero_idle spritesheet at reduced scale.
import * as Phaser from 'phaser';

const WALK_DURATION_MS = 900;

export class AvatarWalker {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Sprite;
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    // Origin (0.5, 0.5) keeps the avatar centered on its target node platform
    // rather than perching above it.
    this.sprite = scene.add.sprite(x, y, 'avatar_sprite').setOrigin(0.5, 0.5).setDepth(20);
    this.sprite.setDisplaySize(110, 110);

    this.dustEmitter = scene.add.particles(0, 0, 'flare', {
      lifespan: 800,
      scale: { start: 0.15, end: 0 },
      alpha: { start: 0.4, end: 0 },
      speedX: { min: -15, max: 15 },
      speedY: { min: -5, max: -20 },
      tint: 0x110c05,
      blendMode: Phaser.BlendModes.MULTIPLY,
      emitting: false
    }).setDepth(19);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  walkTo(
    from: { x: number; y: number },
    to: { x: number; y: number },
    onComplete: () => void,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len;
    const perpY =  dx / len;
    const jitterMag = len * 0.15;
    const cp1 = { x: from.x + dx * 0.33 + perpX * jitterMag, y: from.y + dy * 0.33 + perpY * jitterMag };
    const cp2 = { x: from.x + dx * 0.66 - perpX * jitterMag, y: from.y + dy * 0.66 - perpY * jitterMag };

    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2(cp1.x, cp1.y),
      new Phaser.Math.Vector2(cp2.x, cp2.y),
      new Phaser.Math.Vector2(to.x, to.y),
    );

    const tween = this.scene.tweens.addCounter({
      from: 0, to: 1, duration: WALK_DURATION_MS, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = tween.getValue() ?? 0;
        const p = curve.getPoint(t);
        
        // Joy of movement: Bounding bobbing effect
        const steps = 6;
        const bobY = Math.abs(Math.sin(t * Math.PI * steps)) * 14;
        this.sprite.setPosition(p.x, p.y - bobY);

        // Emit ink dust puff at the feet
        if (Math.random() < 0.4) {
          this.dustEmitter.emitParticleAt(p.x, p.y);
        }
      },
      onComplete: () => {
        // Settle sprite back to exact y
        this.scene.tweens.add({
          targets: this.sprite,
          y: to.y,
          duration: 150,
          ease: 'Power2',
          onComplete
        });
      },
    });
  }
}
