import Phaser from 'phaser';
import { PREMIUM_EXPANSION } from './PremiumExpansionCatalog';

const ATLAS_KEYS = [
  'premium_expansion_atlas_a',
  'premium_expansion_atlas_b',
  'premium_expansion_atlas_c',
] as const;

const ATLAS_URLS = [
  '/assets/premium_expansion_atlas_a.webp?v=20260731b',
  '/assets/premium_expansion_atlas_b.webp?v=20260731b',
  '/assets/premium_expansion_atlas_c.webp?v=20260731b',
] as const;

const CELL = 384;
const PORTRAIT_SIZE = 256;
const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;

interface MotionFrame {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

// A compact trot cycle. The premium PNG remains visually unchanged; these
// transforms provide stride compression, lift, and body pitch without
// degrading the detailed costume artwork.
const MOTION: MotionFrame[] = [
  { x: -3, y: 5, scaleX: 0.985, scaleY: 1.018, rotation: -1.8 },
  { x: 0, y: 1, scaleX: 1.005, scaleY: 0.995, rotation: -0.7 },
  { x: 3, y: -4, scaleX: 1.022, scaleY: 0.975, rotation: 1.2 },
  { x: 2, y: -1, scaleX: 1.010, scaleY: 0.988, rotation: 2.0 },
  { x: -2, y: 4, scaleX: 0.988, scaleY: 1.015, rotation: 0.8 },
  { x: -1, y: 0, scaleX: 1.000, scaleY: 1.000, rotation: -0.5 },
  { x: 3, y: -5, scaleX: 1.020, scaleY: 0.976, rotation: -1.6 },
  { x: 1, y: 0, scaleX: 1.008, scaleY: 0.992, rotation: 0.4 },
];

export function queuePremiumExpansionAtlases(scene: Phaser.Scene): void {
  for (let i = 0; i < ATLAS_KEYS.length; i++) {
    scene.load.image(ATLAS_KEYS[i], ATLAS_URLS[i]);
  }
}

function getAtlasSource(scene: Phaser.Scene, atlasIndex: number): CanvasImageSource | null {
  const texture = scene.textures.get(ATLAS_KEYS[atlasIndex]);
  if (!texture || texture.key === '__MISSING') return null;
  return texture.getSourceImage() as CanvasImageSource;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  atlasCellIndex: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const sx = (atlasCellIndex % 4) * CELL;
  const sy = Math.floor(atlasCellIndex / 4) * CELL;
  ctx.drawImage(source, sx, sy, CELL, CELL, dx, dy, dw, dh);
}

function replaceCanvasTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.Texture | null {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, canvas);
}

function buildPortrait(scene: Phaser.Scene, id: string, source: CanvasImageSource, cellIndex: number): void {
  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_SIZE;
  canvas.height = PORTRAIT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawCell(ctx, source, cellIndex, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
  replaceCanvasTexture(scene, `corgi_${id}`, canvas);
}

function buildRunSheet(scene: Phaser.Scene, id: string, source: CanvasImageSource, cellIndex: number): void {
  const key = `${id}_run`;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * FRAME_COUNT;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const displaySize = 322;
  const half = displaySize / 2;
  const baseY = 176;

  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const m = MOTION[frame];
    const centerX = frame * FRAME_W + FRAME_W / 2 + m.x;
    const centerY = baseY + m.y;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Phaser.Math.DegToRad(m.rotation));
    ctx.scale(m.scaleX, m.scaleY);
    drawCell(ctx, source, cellIndex, -half, -half, displaySize, displaySize);
    ctx.restore();
  }

  const texture = replaceCanvasTexture(scene, key, canvas);
  if (!texture) return;
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    texture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
  }

  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({
    key,
    frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key, frame })),
    frameRate: 14,
    repeat: -1,
  });
}

export function buildPremiumExpansionPngTextures(scene: Phaser.Scene): void {
  for (let index = 0; index < PREMIUM_EXPANSION.length; index++) {
    const def = PREMIUM_EXPANSION[index];
    const atlasIndex = Math.floor(index / 8);
    const cellIndex = index % 8;
    const source = getAtlasSource(scene, atlasIndex);
    if (!source) continue;
    buildPortrait(scene, def.id, source, cellIndex);
    buildRunSheet(scene, def.id, source, cellIndex);
  }
}
