// ABOUTME: Renders a single map node as a parchment medallion (combat/event/rest) or illustrated platform (elite/shop/boss).
// ABOUTME: Exposes setNodeState() for visited/current/available/future visuals.
import * as Phaser from 'phaser';
import type { MapNode, NodeType } from '../models/RegionMap';

export type NodeViewState = 'visited' | 'current' | 'available' | 'future';

const MEDALLION_RADIUS = 36;
const ILLUSTRATED_RADIUS = 48;

const GLYPH_BY_TYPE: Record<NodeType, string> = {
  combat: '⚔',
  elite:  '☠',
  rest:   '🔥',
  event:  '?',
  shop:   '🛍',
  chest:  '⬜',
  boss:   '♛',
};

export class NodeView extends Phaser.GameObjects.Container {
  node: MapNode;
  nodeViewState: NodeViewState = 'future';
  private sprite: Phaser.GameObjects.Image;
  private pulseTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, node: MapNode) {
    super(scene, x, y);
    this.node = node;

    const illustrated = node.type === 'elite' || node.type === 'shop' || node.type === 'boss';
    const radius = illustrated ? ILLUSTRATED_RADIUS : MEDALLION_RADIUS;

    let textureKey = `node_${node.type}`;
    if (node.type === 'elite' || node.type === 'boss') {
      const enemyId = node.data?.kind === 'elite' || node.data?.kind === 'boss' ? (node.data as any).enemyId : '';
      if (enemyId) {
        textureKey = `node_${node.type}_${enemyId.replace('-', '')}`;
      }
    }

    this.sprite = scene.add.image(0, 0, textureKey).setOrigin(0.5);
    // Scale image down by half if we are using 2x sources, or adjust based on radius.
    // Spec says 192x192 source for 96x96 display (which means radius 48, size 96).
    // So target diameter is radius * 2.
    this.sprite.setDisplaySize(radius * 2, radius * 2);
    this.add(this.sprite);

    this.setSize(radius * 2, radius * 2);
    // Circle is positioned at (radius, radius) because Phaser's hit test adds displayOriginX/Y
    // to local coords before running the hit callback, and a centered Container has its
    // displayOrigin at (radius, radius).
    this.setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains);

    // Living Node Ecosystems
    if (node.type === 'shop') {
      const glow = scene.add.sprite(0, -10, 'flare')
        .setScale(2.5) // Much larger, softer falloff
        .setTint(0xffaa33) // Warmer, more lantern-like orange/gold
        .setAlpha(0.15) // Much lower base opacity
        .setBlendMode(Phaser.BlendModes.ADD);
      this.add(glow);
      scene.tweens.add({
        targets: glow,
        alpha: 0.3,
        scale: 2.8,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (node.type === 'rest') {
      const sparks = scene.add.particles(0, 10, 'flare', {
        lifespan: 1500,
        speedY: { min: -15, max: -30 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.12, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffaa00, 0xff4400],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 250
      });
      this.add(sparks);
    } else if (node.type === 'boss') {
      const smoke = scene.add.particles(0, 20, 'flare', {
        lifespan: 3500,
        speedY: { min: -10, max: -20 },
        speedX: { min: -15, max: 15 },
        scale: { start: 0.3, end: 0.6 },
        alpha: { start: 0.3, end: 0 },
        tint: 0x301040,
        blendMode: Phaser.BlendModes.MULTIPLY,
        frequency: 350
      });
      this.add(smoke);
      scene.tweens.add({
        targets: this, // Tween the container to avoid conflicts with tactile hover
        scaleY: 1.03,
        scaleX: 1.01,
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Tactile Hover & Touch Effects
    const baseScale = this.sprite.scaleX;

    this.on('pointerover', () => {
      if (this.nodeViewState === 'future') return;
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: baseScale * 1.15, scaleY: baseScale * 1.15,
        duration: 250,
        ease: 'Back.easeOut'
      });
    });

    this.on('pointerout', () => {
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: baseScale, scaleY: baseScale,
        duration: 200,
        ease: 'Power2'
      });
    });

    this.on('pointerdown', () => {
      if (this.nodeViewState !== 'available') return;
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: baseScale * 0.9, scaleY: baseScale * 0.9,
        duration: 100,
        ease: 'Power2'
      });
    });

    this.on('pointerup', () => {
      if (this.nodeViewState !== 'available') return;
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: baseScale * 1.15, scaleY: baseScale * 1.15,
        duration: 150,
        ease: 'Back.easeOut'
      });
    });

    this.redraw();
  }

  setNodeState(next: NodeViewState): void {
    if (next === this.nodeViewState) return;
    this.nodeViewState = next;
    this.redraw();
  }

  private redraw(): void {
    let alpha = 1;
    let tint = 0xffffff;
    let blendMode = Phaser.BlendModes.NORMAL;

    // Use MULTIPLY to make the parchment background of the node vanish into the map, leaving only the ink!
    if (this.nodeViewState === 'future') { 
      alpha = 0.45; 
      blendMode = Phaser.BlendModes.MULTIPLY;
    }
    if (this.nodeViewState === 'visited') { 
      alpha = 0.8; 
      blendMode = Phaser.BlendModes.MULTIPLY;
    } 
    if (this.nodeViewState === 'available') { 
      tint = 0xffffff; 
      blendMode = Phaser.BlendModes.NORMAL;
    }

    this.sprite.setTint(tint);
    this.sprite.setAlpha(alpha);
    this.sprite.setBlendMode(blendMode);

    if (this.nodeViewState === 'available' && !this.pulseTween) {
      this.pulseTween = this.scene.tweens.add({
        targets: this,
        scaleX: 1.08, scaleY: 1.08,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (this.nodeViewState !== 'available' && this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
      this.setScale(1);
    }

    this.setAlpha(this.nodeViewState === 'future' ? 0.7 : 1);
  }
}
