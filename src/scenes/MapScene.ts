// ABOUTME: Phaser scene that renders a RegionMap from RunState as a scrollable parchment column.
// ABOUTME: Coordinates phase transitions, dispatches modals, and handles avatar travel + node-action.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import type { MapNode } from '../models/RegionMap';
import { applyOutcomes } from '../run/applyOutcomes';
import { setPhase, setCurrentNode, usePotion } from '../run/transitions';
import { nextUnlockableEpoch } from '../content/epochs';
import { pickEvent } from '../content/events';
import { NodeView, type NodeViewState } from '../ui/NodeView';
import { PathRenderer, type EdgeCoords } from '../ui/PathRenderer';
import { AvatarWalker } from '../ui/AvatarWalker';
import { MapHud } from '../ui/MapHud';
import { RestModal } from '../ui/RestModal';
import { RewardModal } from '../ui/modals/RewardModal';
import { ChestModal } from '../ui/modals/ChestModal';
import { MerchantModal } from '../ui/modals/MerchantModal';
import { EventModal } from '../ui/modals/EventModal';
import { BossVictoryModal } from '../ui/modals/BossVictoryModal';
import { DeathModal } from '../ui/modals/DeathModal';
import { EpochUnlockModal } from '../ui/modals/EpochUnlockModal';
import { QaDebugPanel } from '../ui/QaDebugPanel';

const COLUMN_X_MIN = 360;
const COLUMN_X_MAX = 920;
const LANE_X: Record<number, number> = { 0: 460, 1: 640, 2: 820 };
const FLOOR_Y: Record<number, number> = { 1: 1220, 2: 980, 3: 740, 4: 500, 5: 260 };
const WORLD_HEIGHT = 1440;

export interface MapSceneData {
  runState: RunState;
}

export class MapScene extends Phaser.Scene {
  private runState!: RunState;
  private nodeViews = new Map<string, NodeView>();
  private paths!: PathRenderer;
  private avatar!: AvatarWalker;
  private hud!: MapHud;
  private activeModal: Phaser.GameObjects.Container | undefined;
  private isTraveling = false;
  private qaPanel: QaDebugPanel | null = null;

  private twilightOverlay!: Phaser.GameObjects.Rectangle;

  constructor() { super('MapScene'); }

  init(data: MapSceneData): void {
    this.runState = data.runState;
    // Reset transient scene state. Phaser reuses scene instances across scene.start(),
    // so field initializers don't re-run — we must clear them explicitly on every init.
    this.isTraveling = false;
    this.activeModal = undefined;
    this.nodeViews.clear();
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, 1280, WORLD_HEIGHT);

    // Parchment sidebars (fixed to camera).
    this.add.rectangle(COLUMN_X_MIN / 2, 360, COLUMN_X_MIN, 720, 0xd9c9a0).setScrollFactor(0).setDepth(-10);
    this.add.rectangle((1280 + COLUMN_X_MAX) / 2, 360, 1280 - COLUMN_X_MAX, 720, 0xd9c9a0).setScrollFactor(0).setDepth(-10);

    // Parchment column background (scrolls with the map).
    this.add.tileSprite(COLUMN_X_MIN + (COLUMN_X_MAX - COLUMN_X_MIN) / 2, WORLD_HEIGHT / 2, COLUMN_X_MAX - COLUMN_X_MIN, WORLD_HEIGHT, 'map_bg').setDepth(-5);

    // Add shading lines on edges
    const column = this.add.graphics();
    column.fillStyle(0x000000, 0.08);
    column.fillRect(COLUMN_X_MIN, 0, 6, WORLD_HEIGHT);
    column.fillRect(COLUMN_X_MAX - 6, 0, 6, WORLD_HEIGHT);
    column.setDepth(-4);

    // Ambient Flourishes (Scattered Ink Blots)
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(COLUMN_X_MIN + 40, COLUMN_X_MAX - 40);
      const y = Phaser.Math.Between(100, WORLD_HEIGHT - 100);
      const scale = Phaser.Math.FloatBetween(0.5, 2.0);
      const alpha = Phaser.Math.FloatBetween(0.02, 0.08);
      const rot = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.add.image(x, y, 'ink_blot').setScale(scale).setAlpha(alpha).setRotation(rot).setDepth(-3);
    }

    // Ambient Mist Clouds (Sumi-e flowing mist)
    for (let i = 0; i < 8; i++) {
      const y = Phaser.Math.Between(0, WORLD_HEIGHT);
      const x = Phaser.Math.Between(COLUMN_X_MIN, COLUMN_X_MAX);
      const cloud = this.add.image(x, y, 'mist_cloud').setOrigin(0.5).setAlpha(0.2).setDepth(-2).setScale(Phaser.Math.FloatBetween(1.2, 1.8));

      const duration = Phaser.Math.Between(15000, 25000);
      this.tweens.add({
        targets: cloud,
        x: x - Phaser.Math.Between(150, 300),
        duration,
        ease: 'Linear',
        yoyo: true,
        repeat: -1
      });
      this.tweens.add({
        targets: cloud,
        alpha: 0.05,
        duration: Phaser.Math.Between(5000, 8000),
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    }

    // Ambient Particles (Living Environment: falling petals)
    this.add.particles(0, 0, 'petal', {
      x: { min: COLUMN_X_MIN, max: COLUMN_X_MAX },
      y: { min: 0, max: WORLD_HEIGHT },
      lifespan: 10000,
      speedX: { min: -15, max: 15 },
      gravityY: 15,
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.6, end: 0, ease: 'Sine.easeInOut' },
      rotate: { min: 0, max: 360 },
      frequency: 250,
      tint: [ 0xffb7c5, 0xffe4e1, 0xffffff ]
    }).setDepth(15);

    // Build edge coords (same xy math used by PathRenderer and AvatarWalker).
    const edgeCoords = new Map<string, EdgeCoords>();
    for (const e of this.runState.map.edges) {
      const a = this.runState.map.nodes.find(n => n.id === e.from)!;
      const b = this.runState.map.nodes.find(n => n.id === e.to)!;
      edgeCoords.set(`${e.from}->${e.to}`, {
        from: { x: LANE_X[a.lane]!, y: FLOOR_Y[a.floor]! },
        to:   { x: LANE_X[b.lane]!, y: FLOOR_Y[b.floor]! },
      });
    }
    this.paths = new PathRenderer(this, edgeCoords);
    this.paths.renderAll(this.runState.map);

    // Nodes.
    for (const n of this.runState.map.nodes) {
      const view = new NodeView(this, LANE_X[n.lane]!, FLOOR_Y[n.floor]!, n);
      view.setDepth(10);
      view.on('pointerdown', () => this.onNodeTapped(n));
      this.add.existing(view);
      this.nodeViews.set(n.id, view);
    }

    // Avatar.
    const startPos = this.avatarRestingPosition();
    this.avatar = new AvatarWalker(this, startPos.x, startPos.y);

    // HUD.
    this.hud = new MapHud(this, (slot) => this.onPotionUsedFromMap(slot));
    this.add.existing(this.hud);

    // Mouse-wheel scroll.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy, 0, WORLD_HEIGHT - 720);
    });

    // Touch drag scroll.
    let dragStartY = 0;
    let dragStartScroll = 0;
    let isDragging = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.activeModal) return;
      isDragging = false;
      dragStartY = p.y;
      dragStartScroll = this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.activeModal) return;
      const dy = dragStartY - p.y;
      if (!isDragging && Math.abs(dy) > 8) isDragging = true;
      if (isDragging) {
        this.cameras.main.scrollY = Phaser.Math.Clamp(dragStartScroll + dy, 0, WORLD_HEIGHT - 720);
      }
    });
    this.input.on('pointerup', () => { isDragging = false; });

    // Time of Day (Twilight Overlay)
    this.twilightOverlay = this.add.rectangle(COLUMN_X_MIN, 0, COLUMN_X_MAX - COLUMN_X_MIN, WORLD_HEIGHT, 0x4a2040)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(90)
      .setAlpha(0);

    // Interactive Ink Drops (Procedural Multi-Style Splatters)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.activeModal || this.isTraveling) return;

      // Robust check: Did we hit a node?
      const nodes = Array.from(this.nodeViews.values());
      const hits = this.input.manager.hitTest(p, nodes, this.cameras.main);

      if (hits.length === 0) {
        this.spawnInkDrop(p.worldX, p.worldY);
      }
    });

    // Scroll Entrance Unroll Animation
    this.cameras.main.scrollY = 0;
    const targetY = Phaser.Math.Clamp(startPos.y - 360, 0, WORLD_HEIGHT - 720);
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: targetY,
      duration: 2500,
      ease: 'Cubic.easeInOut',
      delay: 300
    });

    // Audio — parchment unfurl on entrance, then Japanese BGM loop under everything.
    this.time.delayedCall(300, () => {
      if (this.sound.get('map-scroll-unfurl')) return;
      this.sound.play('map-scroll-unfurl', { volume: 0.5 });
    });
    const bgm = this.sound.add('map-bgm', { loop: true, volume: 0.25 });
    bgm.play();
    this.events.once('shutdown', () => {
      this.sound.stopByKey('map-bgm');
    });

    // Wire RunState change observer and paint initial state.
    this.runState.onStateChanged = () => this.onRunStateChanged();
    this.onRunStateChanged();

    this.qaPanel = new QaDebugPanel(this, this.runState);
    this.add.existing(this.qaPanel);
    this.input.keyboard?.on('keydown-BACKTICK', () => this.qaPanel?.toggle());
  }

  private avatarRestingPosition(): { x: number; y: number } {
    if (this.runState.currentNodeId) {
      const n = this.runState.map.nodes.find(m => m.id === this.runState.currentNodeId)!;
      return { x: LANE_X[n.lane]!, y: FLOOR_Y[n.floor]! };
    }
    // Before the first pick — perch below floor 1, centered. Smaller offset so the
    // centered-origin avatar doesn't clip past the bottom of the world bounds.
    return { x: 640, y: FLOOR_Y[1]! + 55 };
  }

  private centerCameraOn(worldY: number): void {
    const target = Phaser.Math.Clamp(worldY - 360, 0, WORLD_HEIGHT - 720);
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: target,
      duration: 500,
      ease: 'Power2',
    });
  }

  private updateTimeOfDay(floor: number) {
    if (!this.twilightOverlay) return;
    const targetAlpha = floor === 5 ? 0.35 : 0;
    this.tweens.add({
      targets: this.twilightOverlay,
      alpha: targetAlpha,
      duration: 3000
    });
  }

  private currentFloor(): number {
    if (!this.runState.currentNodeId) return 1;
    const n = this.runState.map.nodes.find(m => m.id === this.runState.currentNodeId);
    return n?.floor ?? 1;
  }

  private refreshNodeStates(): void {
    const available = this.availableNextIds();
    for (const [id, view] of this.nodeViews) {
      let state: NodeViewState;
      if (this.runState.visitedNodeIds.includes(id)) state = 'visited';
      else if (id === this.runState.currentNodeId) state = 'current';
      else if (available.includes(id)) state = 'available';
      else state = 'future';
      view.setNodeState(state);
    }
    // Path states.
    for (const e of this.runState.map.edges) {
      const visited = this.runState.visitedNodeIds;
      const traversed = visited.includes(e.from) && (visited.includes(e.to) || e.to === this.runState.currentNodeId);
      if (traversed) this.paths.setState(e, 'completed');
      else if (e.from === this.runState.currentNodeId && available.includes(e.to)) this.paths.setState(e, 'available');
      else this.paths.setState(e, 'future');
    }
  }

  private availableNextIds(): string[] {
    if (!this.runState.currentNodeId) return [...this.runState.map.startNodeIds];
    return this.runState.map.edges
      .filter(e => e.from === this.runState.currentNodeId)
      .map(e => e.to);
  }

  private onNodeTapped(node: MapNode): void {
    if (this.activeModal) return;
    if (this.isTraveling) return;
    if (this.runState.phase !== 'MAP') return;
    const available = this.availableNextIds();
    if (!available.includes(node.id)) return;
    this.travelToNode(node);
  }

  protected travelToNode(node: MapNode): void {
    const from = this.avatarRestingPosition();
    const to = { x: LANE_X[node.lane]!, y: FLOOR_Y[node.floor]! };
    this.centerCameraOn(to.y);
    this.isTraveling = true;
    // Rhythmic footsteps while walking. Three random variants, spaced to match
    // the bob cadence of the avatar (~150ms) without spamming the sound channel.
    const stepKeys = ['map-footstep-1', 'map-footstep-2', 'map-footstep-3'];
    const stepTimer = this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        const key = stepKeys[Math.floor(Math.random() * stepKeys.length)]!;
        this.sound.play(key, { volume: 0.35, rate: 0.9 + Math.random() * 0.2 });
      },
    });
    this.avatar.walkTo(from, to, () => {
      stepTimer.remove();
      // Settle — one last softer step on arrival.
      this.sound.play(stepKeys[0]!, { volume: 0.25, rate: 0.75 });
      this.onArrived(node);
    });
  }

  protected onArrived(node: MapNode): void {
    // Record visit: previous current becomes visited, new node becomes current.
    if (this.runState.currentNodeId) this.runState.visitedNodeIds.push(this.runState.currentNodeId);
    setCurrentNode(this.runState, node.id);
    // Reset before dispatch: non-combat modals keep us in MapScene, so subsequent node
    // taps (after the modal resolves and phase returns to MAP) need this cleared.
    this.isTraveling = false;

    // Set the phase for the node type. CombatScene handles its own phase change on win.
    switch (node.type) {
      case 'combat':
      case 'elite':
      case 'boss':
        this.launchCombat(node);
        break;
      case 'rest':
        setPhase(this.runState, 'REST');
        break;
      case 'event':
        setPhase(this.runState, 'EVENT');
        break;
      case 'shop':
        setPhase(this.runState, 'MERCHANT');
        break;
      case 'chest':
        setPhase(this.runState, 'CHEST');
        break;
    }
  }

  private launchCombat(node: MapNode): void {
    const enemyId = node.data?.kind === 'combat' || node.data?.kind === 'elite' || node.data?.kind === 'boss'
      ? node.data.enemyId
      : 'thorn-creep';
    setPhase(this.runState, 'COMBAT');
    this.scene.start('CombatScene', { runState: this.runState, enemyId, nodeType: node.type });
  }

  private onRunStateChanged(): void {
    this.hud.update(this.runState);
    this.refreshNodeStates();
    this.updateTimeOfDay(this.currentFloor());

    // Phase → modal dispatch (only if no modal is already open for this phase).
    if (this.activeModal) return;
    switch (this.runState.phase) {
      case 'REWARD':
        this.openModal(new RewardModal(this, this.runState, o => this.resolveAndAdvance(o, 'MAP')));
        break;
      case 'CHEST':
        this.openModal(new ChestModal(this, this.runState, o => this.resolveAndAdvance(o, 'MAP')));
        break;
      case 'MERCHANT':
        this.openModal(new MerchantModal(this, this.runState, o => this.resolveAndAdvance(o, 'MAP')));
        break;
      case 'EVENT':
        this.openEvent();
        break;
      case 'REST':
        this.openRest();
        break;
      case 'BOSS_VICTORY':
        this.openModal(new BossVictoryModal(this, this.runState, () => this.afterRunEnd()));
        break;
      case 'DEATH':
        this.openModal(new DeathModal(this, this.runState, () => this.afterRunEnd()));
        break;
      case 'EPOCH_UNLOCK': {
        const epoch = nextUnlockableEpoch(this.runState);
        if (!epoch) { setPhase(this.runState, 'MAP'); break; }
        this.openModal(new EpochUnlockModal(this, this.runState, epoch, () => this.restartInEpoch(epoch.epoch)));
        break;
      }
    }
  }

  private openModal(modal: Phaser.GameObjects.Container): void {
    this.activeModal = modal;
    this.add.existing(modal);
  }

  private openEvent(): void {
    // Pick a random event from the Region 1 pool for this visit.
    const rng = () => Math.random();
    const ev = pickEvent(rng);
    this.openModal(new EventModal(this, this.runState, ev, (outcomes) => {
      const combat = outcomes.find(o => o.kind === 'enter_combat');
      if (combat) {
        const combatOutcome = combat as { kind: 'enter_combat'; enemyId: string; returnPhase: string };
        this.activeModal = undefined;
        setPhase(this.runState, 'COMBAT');
        this.scene.start('CombatScene', { runState: this.runState, enemyId: combatOutcome.enemyId, nodeType: 'combat' });
      } else {
        this.resolveAndAdvance(outcomes, 'MAP');
      }
    }));
  }

  private openRest(): void {
    this.openModal(new RestModal(this, this.runState.playerHp, this.runState.playerMaxHp, 0.30, (result) => {
      this.resolveAndAdvance([{ kind: 'heal', amount: result.healedBy }], 'MAP');
    }));
  }

  private resolveAndAdvance(outcomes: RunOutcome[], nextPhase: 'MAP' | 'COMBAT'): void {
    this.activeModal = undefined;
    // Set terminal phase first so re-entrant onStateChanged emits during applyOutcomes
    // don't re-open a modal for the pre-resolve phase (EVENT/REWARD/etc).
    // If an outcome is enter_combat, applyOutcomes will overwrite to COMBAT anyway.
    // If it's takeDamage to 0, transitions set phase=DEATH.
    const hasCombat = outcomes.some(o => o.kind === 'enter_combat');
    if (!hasCombat) {
      setPhase(this.runState, nextPhase);
    }
    applyOutcomes(this.runState, outcomes);
  }

  private onPotionUsedFromMap(slot: number): void {
    const potion = this.runState.potions[slot];
    if (!potion || !potion.usableInMap) return;
    if (potion.effect.kind === 'heal') {
      applyOutcomes(this.runState, [{ kind: 'heal', amount: potion.effect.amount }]);
    }
    usePotion(this.runState, slot);
  }

  private afterRunEnd(): void {
    // Check for epoch unlock; if unlocked, transition to EPOCH_UNLOCK so the next render shows the modal.
    const unlock = nextUnlockableEpoch(this.runState);
    if (unlock) {
      this.activeModal = undefined;
      setPhase(this.runState, 'EPOCH_UNLOCK');
    } else {
      this.restartInEpoch(this.runState.currentEpoch);
    }
  }

  private restartInEpoch(epoch: number): void {
    // Rebuild a fresh run in the given epoch and re-enter via BootScene.
    this.activeModal = undefined;
    this.scene.start('BootScene', { forceNewRun: true, epoch });
  }

  private spawnInkDrop(worldX: number, worldY: number): void {
    const size = 220;
    const depth = 21;

    // Signature sumi-e deep brown/black as linear RGB for the shader.
    const ink = { r: 0x11 / 255, g: 0x0a / 255, b: 0x05 / 255 };

    // Per-splat state the shader reads every render.
    const state = {
      time: 0,
      seed: Phaser.Math.FloatBetween(0, 1000),
      alpha: 1,
      growth: 0,
    };

    const shader = this.add.shader({
      name: 'InkShader',
      shaderName: 'InkShader',
      fragmentKey: 'ink_shader',
      setupUniforms: (setUniform: (name: string, value: unknown) => void) => {
        setUniform('uTime', state.time);
        setUniform('uSeed', state.seed);
        setUniform('uAlpha', state.alpha);
        setUniform('uGrowth', state.growth);
        setUniform('uInkColor', [ink.r, ink.g, ink.b]);
      },
    }, worldX, worldY, size, size);

    shader.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(depth);

    const startTime = this.time.now;
    const advance = (_t: number, delta: number) => {
      state.time = (this.time.now - startTime) / 1000;
      void delta;
    };
    this.events.on('update', advance);

    // Ink drops, spreads, then dries and fades out.
    this.tweens.add({
      targets: state,
      growth: 1,
      duration: 450,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: state,
      alpha: 0,
      duration: 4500,
      delay: 1500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.events.off('update', advance);
        shader.destroy();
      },
    });

    this.events.once('shutdown', () => {
      this.events.off('update', advance);
      if (shader.active) shader.destroy();
    });
  }
}
