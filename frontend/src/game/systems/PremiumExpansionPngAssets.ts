import Phaser from 'phaser';
import { PREMIUM_EXPANSION } from './PremiumExpansionCatalog';
import { PREMIUM_ATLAS_DATA_URLS } from './PremiumAtlasData';

const ATLAS_KEYS = [
  'premium_expansion_atlas_a_png',
  'premium_expansion_atlas_b_png',
  'premium_expansion_atlas_c_png',
] as const;

const CELL = 120;
const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;
const FOOT_BASELINE = 340;

interface MotionFrame {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

interface AlphaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A restrained eight-frame trot. The approved illustration remains intact;
// the complete body and costume move together, preventing detached clothing
// or missing body pieces during jump/fall frame changes.
const MOTION: MotionFrame[] = [
  { x: -3, y: 3, scaleX: 0.992, scaleY: 1.008, rotation: -1.1 },
  { x: 0, y: 0, scaleX: 1.004, scaleY: 0.996, rotation: -0.4 },
  { x: 2, y: -4, scaleX: 1.012, scaleY: 0.988, rotation: 0.8 },
  { x: 1, y: -2, scaleX: 1.006, scaleY: 0.994, rotation: 1.2 },
  { x: -2, y: 3, scaleX: 0.992, scaleY: 1.008, rotation: 0.6 },
  { x: -1, y: 0, scaleX: 1.000, scaleY: 1.000, rotation: -0.3 },
  { x: 2, y: -5, scaleX: 1.010, scaleY: 0.990, rotation: -0.9 },
  { x: 1, y: -1, scaleX: 1.004, scaleY: 0.996, rotation: 0.2 },
];

export function queuePremiumExpansionAtlases(scene: Phaser.Scene): void {
  for (let i = 0; i < ATLAS_KEYS.length; i++) {
    scene.load.image(ATLAS_KEYS[i], PREMIUM_ATLAS_DATA_URLS[i]);
  }
}

function getAtlasSource(scene: Phaser.Scene, atlasIndex: number): CanvasImageSource | null {
  const key = ATLAS_KEYS[atlasIndex];
  if (!scene.textures.exists(key)) return null;
  const texture = scene.textures.get(key);
  if (!texture || texture.key === '__MISSING') return null;
  return texture.getSourceImage() as CanvasImageSource;
}

function extractCell(source: CanvasImageSource, cellIndex: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const sx = (cellIndex % 4) * CELL;
  const sy = Math.floor(cellIndex / 4) * CELL;
  ctx.drawImage(source, sx, sy, CELL, CELL, 0, 0, CELL, CELL);
  return canvas;
}

function findAlphaBounds(canvas: HTMLCanvasElement): AlphaBounds | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha <= 6) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function replaceCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
): Phaser.Textures.Texture | null {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, canvas);
}

function buildPortrait(scene: Phaser.Scene, id: string, cell: HTMLCanvasElement): void {
  // Store cards use the exact approved transparent illustration, not a
  // procedural fallback or a recolored Classic corgi.
  replaceCanvasTexture(scene, `corgi_${id}`, cell);
}

function buildRunSheet(
  scene: Phaser.Scene,
  id: string,
  cell: HTMLCanvasElement,
  bounds: AlphaBounds,
): void {
  const key = `${id}_run`;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * FRAME_COUNT;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fit the visible dog, rather than the transparent atlas cell, so all
  // expansion corgis match the original gameplay scale.
  const maxWidth = 336;
  const maxHeight = 326;
  const fit = Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
  const drawWidth = bounds.width * fit;
  const drawHeight = bounds.height * fit;

  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const motion = MOTION[frame];
    const centerX = frame * FRAME_W + FRAME_W / 2 + motion.x;
    const baselineY = FOOT_BASELINE + motion.y;
    ctx.save();
    ctx.translate(centerX, baselineY);
    ctx.rotate(Phaser.Math.DegToRad(motion.rotation));
    ctx.scale(motion.scaleX, motion.scaleY);
    ctx.drawImage(
      cell,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      -drawWidth / 2,
      -drawHeight,
      drawWidth,
      drawHeight,
    );
    ctx.restore();
  }

  const texture = replaceCanvasTexture(scene, key, canvas);
  if (!texture) return;
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    texture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
  }
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
    const cell = extractCell(source, cellIndex);
    const bounds = findAlphaBounds(cell);
    if (!bounds) continue;
    buildPortrait(scene, def.id, cell);
    buildRunSheet(scene, def.id, cell, bounds);
  }
}
