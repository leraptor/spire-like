// ABOUTME: Draws all edges of a RegionMap as cubic Bézier ink paths with per-edge state (future/available/completed).
// ABOUTME: One graphics object per edge so states can be toggled without redrawing everything.
import * as Phaser from 'phaser';
import type { RegionMap, MapEdge } from '../models/RegionMap';

export type PathState = 'future' | 'available' | 'completed';

export interface EdgeCoords {
  from: { x: number; y: number };
  to:   { x: number; y: number };
}

export class PathRenderer {
  private scene: Phaser.Scene;
  private graphicsByEdge = new Map<string, Phaser.GameObjects.Graphics>();
  private coordsByEdge: Map<string, EdgeCoords>;
  private animationsByEdge = new Map<string, { sprites: Phaser.GameObjects.Sprite[], tweens: Phaser.Tweens.Tween[] }>();

  constructor(scene: Phaser.Scene, coords: Map<string, EdgeCoords>) {
    this.scene = scene;
    this.coordsByEdge = coords;
  }

  renderAll(map: RegionMap): void {
    for (const e of map.edges) {
      const key = edgeKey(e);
      if (this.graphicsByEdge.has(key)) continue;
      const g = this.scene.add.graphics();
      g.setDepth(5);
      g.setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.graphicsByEdge.set(key, g);
      this.drawEdge(e, 'future');
    }
  }

  setState(edge: MapEdge, state: PathState): void {
    this.drawEdge(edge, state);
  }

  private drawEdge(edge: MapEdge, state: PathState): void {
    const key = edgeKey(edge);
    const g = this.graphicsByEdge.get(key);
    const coords = this.coordsByEdge.get(key);
    if (!g || !coords) return;
    g.clear();
    
    // Clean up any old pulse animations
    if (this.animationsByEdge.has(key)) {
      const anims = this.animationsByEdge.get(key)!;
      anims.tweens.forEach(t => t.stop());
      anims.sprites.forEach(s => s.destroy());
      this.animationsByEdge.delete(key);
    }

    g.setBlendMode(state === 'completed' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.MULTIPLY);

    const { from, to } = coords;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    // Perpendicular offset for the Bézier control points.
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

    // Draw a very faint, delicate continuous thread connecting the nodes
    if (state === 'completed') {
       g.lineStyle(2, 0xc89b3c, 0.4);
    } else {
       g.lineStyle(2, 0x2a1a0d, 0.15);
    }
    
    const excludeRadius = 42; // Distance from node center to trim the path
    
    g.beginPath();
    let isDrawing = false;
    const curvePoints = curve.getSpacedPoints(100);
    curvePoints.forEach(p => {
      const distFrom = Phaser.Math.Distance.Between(p.x, p.y, from.x, from.y);
      const distTo = Phaser.Math.Distance.Between(p.x, p.y, to.x, to.y);
      if (distFrom > excludeRadius && distTo > excludeRadius) {
        if (!isDrawing) {
          g.moveTo(p.x, p.y);
          isDrawing = true;
        } else {
          g.lineTo(p.x, p.y);
        }
      } else {
        isDrawing = false;
      }
    });
    g.strokePath();

    // Generate points for the dotted trail overlay
    const dotSpacing = 18;
    const numPoints = Math.floor(len / dotSpacing);
    const points = curve.getSpacedPoints(numPoints);

    const isOutsideNode = (p: Phaser.Math.Vector2) => {
      return Phaser.Math.Distance.Between(p.x, p.y, from.x, from.y) > excludeRadius &&
             Phaser.Math.Distance.Between(p.x, p.y, to.x, to.y) > excludeRadius;
    };

    if (state === 'future') {
      g.fillStyle(0x2a1a0d, 0.25);
      points.forEach(p => {
        if (isOutsideNode(p)) {
          g.fillCircle(p.x, p.y, 2.5);
        }
      });
    } else if (state === 'completed') {
      // Golden glowing completed trail
      g.fillStyle(0xc89b3c, 0.9);
      points.forEach(p => {
        if (isOutsideNode(p)) {
          g.fillCircle(p.x, p.y, 3.5);
        }
      });
      g.fillStyle(0xc89b3c, 0.3);
      points.forEach(p => {
        if (isOutsideNode(p)) {
          g.fillCircle(p.x, p.y, 6);
        }
      });
    } else if (state === 'available') {
      const sprites: Phaser.GameObjects.Sprite[] = [];
      const tweens: Phaser.Tweens.Tween[] = [];
      
      points.forEach((p, index) => {
        if (isOutsideNode(p)) {
          // Add a pulsing ink dot using the flare texture
          const dot = this.scene.add.sprite(p.x, p.y, 'flare')
            .setScale(0.12)
            .setTint(0x110c05)
            .setAlpha(0.15)
            .setBlendMode(Phaser.BlendModes.MULTIPLY)
            .setDepth(4);
          
          sprites.push(dot);

          // Flowing pulse animation cascading smoothly upwards
          const tw = this.scene.tweens.add({
            targets: dot,
            alpha: 0.9,
            scale: 0.25,
            duration: 800,
            yoyo: true,
            repeat: -1,
            delay: index * 90,
            ease: 'Sine.easeInOut'
          });
          tweens.push(tw);
        }
      });
      
      this.animationsByEdge.set(key, { sprites, tweens });
    }
  }
}

function edgeKey(e: MapEdge): string {
  return `${e.from}->${e.to}`;
}
