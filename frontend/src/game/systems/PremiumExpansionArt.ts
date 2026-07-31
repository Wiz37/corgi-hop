import Phaser from 'phaser';
import type { ExpansionDef } from './PremiumExpansionCatalog';
import { FRAME_W, FRAME_H, FRAME_COUNT, PORTRAIT_SIZE, RUN_POSES, type Pose, drawBodyBase } from './PremiumExpansionArtCore';
import { drawBehindA, drawFrontA } from './PremiumExpansionOutfitsA';
import { drawBehindB, drawFrontB } from './PremiumExpansionOutfitsB';

function drawCorgi(ctx: CanvasRenderingContext2D, def: ExpansionDef | null, frame: number, portrait: boolean): void {
  const baseScale = portrait ? 0.88 : 0.92;
  const poseData = portrait ? { bob: 0, tilt: 0, frontNear: 5, frontFar: -3, rearNear: -4, rearFar: 3, tail: 0 } : RUN_POSES[frame % FRAME_COUNT];
  const pose: Pose = { x: portrait ? 116 : FRAME_W / 2 - 8, y: portrait ? 169 : 238, scale: baseScale, ...poseData };
  if (def) { drawBehindA(ctx, def, pose.x, pose.y + pose.bob, pose.scale); drawBehindB(ctx, def, pose.x, pose.y + pose.bob, pose.scale); }
  const anchors = drawBodyBase(ctx, def, pose);
  if (def) { drawFrontA(ctx, def, anchors); drawFrontB(ctx, def, anchors); }
}

export function buildPremiumPortrait(scene: Phaser.Scene, def: ExpansionDef): void {
  const key = `corgi_${def.id}`;
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas'); canvas.width = PORTRAIT_SIZE; canvas.height = PORTRAIT_SIZE;
  const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.imageSmoothingEnabled = true;
  drawCorgi(ctx, def, 0, true); scene.textures.addCanvas(key, canvas);
}

export function buildPremiumRun(scene: Phaser.Scene, def: ExpansionDef | null, key: string): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas'); canvas.width = FRAME_W * FRAME_COUNT; canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.imageSmoothingEnabled = true;
  for (let frame = 0; frame < FRAME_COUNT; frame++) { ctx.save(); ctx.translate(frame * FRAME_W, 0); drawCorgi(ctx, def, frame, false); ctx.restore(); }
  const texture = scene.textures.addCanvas(key, canvas); if (!texture) return;
  for (let frame = 0; frame < FRAME_COUNT; frame++) texture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key, frame })), frameRate: 14, repeat: -1 });
}
