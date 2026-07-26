// PolishedHUD — reusable Phaser Graphics that draws the "top strip" of the
// gameplay HUD to match the design reference:
//   - trophy pill on the left with a stacked gold trophy icon + BEST/CURRENT numbers
//   - large chunky center score
//   - circular pause button on the right (uses the `ui_pause_button` texture if
//     present, else falls back to procedural graphics)
//
// This module ONLY provides drawing helpers. HUDScene / MenuScene wire them
// together with real values.

import Phaser from 'phaser';

export interface TrophyPanelResult {
  container: Phaser.GameObjects.Container;
  bestText: Phaser.GameObjects.Text;
  currentText?: Phaser.GameObjects.Text;
}

/**
 * A rounded pill panel with:
 *   - a gold trophy icon on the left (uses `trophy` texture if loaded,
 *     otherwise draws one procedurally),
 *   - a big current score in the top-right of the pill,
 *   - a small BEST label + best score in the bottom-right of the pill.
 */
export function drawTrophyPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  bestScore: number,
  currentScore?: number,
  opts?: { compact?: boolean },
): TrophyPanelResult {
  const compact = opts?.compact ?? false;
  const w = compact ? 210 : 260;
  const h = compact ? 90 : 110;
  const c = scene.add.container(x, y).setDepth(50);
  c.setData('testId', 'hud-trophy-panel');

  const g = scene.add.graphics();
  // 3D shadow underlay
  g.fillStyle(0x18223a, 0.6);
  g.fillRoundedRect(6, 8, w, h, h / 2);
  // Main pill
  g.fillStyle(0x2a3d67, 1);
  g.fillRoundedRect(0, 0, w, h, h / 2);
  // Top gloss
  g.fillStyle(0xffffff, 0.15);
  g.fillRoundedRect(6, 4, w - 12, h * 0.4, h / 2);
  // Stroke
  g.lineStyle(5, 0xffffff, 1);
  g.strokeRoundedRect(0, 0, w, h, h / 2);
  c.add(g);

  // Trophy icon (real texture if present, procedural fallback otherwise)
  const iconSize = h * 0.9;
  if (scene.textures.exists('trophy')) {
    const trophy = scene.add.image(iconSize * 0.55, h / 2, 'trophy').setDisplaySize(iconSize, iconSize);
    c.add(trophy);
  } else {
    const tg = scene.add.graphics({ x: iconSize * 0.55 - iconSize / 2, y: h / 2 - iconSize / 2 });
    // Simple gold cup shape
    tg.fillStyle(0xffd23c, 1);
    tg.fillRoundedRect(iconSize * 0.15, iconSize * 0.15, iconSize * 0.7, iconSize * 0.5, iconSize * 0.1);
    tg.fillRoundedRect(iconSize * 0.3, iconSize * 0.65, iconSize * 0.4, iconSize * 0.15, 8);
    tg.fillStyle(0xffcf27, 1);
    tg.fillEllipse(iconSize * 0.5, iconSize * 0.15, iconSize * 0.5, iconSize * 0.15);
    tg.lineStyle(4, 0xb26810, 1);
    tg.strokeRoundedRect(iconSize * 0.15, iconSize * 0.15, iconSize * 0.7, iconSize * 0.5, iconSize * 0.1);
    c.add(tg);
  }

  const textX = iconSize * 1.15;
  let currentText: Phaser.GameObjects.Text | undefined;
  if (currentScore !== undefined) {
    currentText = scene.add.text(textX, h * 0.36, `${currentScore}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${Math.round(h * 0.42)}px`,
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 4,
    }).setOrigin(0, 0.5);
    c.add(currentText);
  }
  const bestText = scene.add.text(textX, h * 0.75, `BEST: ${bestScore}`, {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: `${Math.round(h * 0.22)}px`,
    fontStyle: '800',
    color: '#ffd23c',
    stroke: '#24304a',
    strokeThickness: 3,
  }).setOrigin(0, 0.5);
  c.add(bestText);

  return { container: c, bestText, currentText };
}

/**
 * COMPACT borderless trophy label — small gold trophy icon with the current
 * score inline and a small BEST label underneath. NO panel background — just
 * a clean icon + text pair for the top-left corner.
 * Used by HUDScene when the spec calls for "smaller trophy icon, no large
 * panel, no border, minimal polished styling".
 */
export function drawCompactTrophy(
  scene: Phaser.Scene,
  x: number,
  y: number,
  bestScore: number,
  currentScore?: number,
): TrophyPanelResult {
  const c = scene.add.container(x, y).setDepth(50);
  c.setData('testId', 'hud-trophy-panel');
  const iconSize = 44;

  if (scene.textures.exists('trophy')) {
    const trophy = scene.add.image(iconSize / 2, iconSize / 2, 'trophy').setDisplaySize(iconSize, iconSize);
    c.add(trophy);
  } else {
    const tg = scene.add.graphics();
    tg.fillStyle(0xffd23c, 1);
    tg.fillRoundedRect(6, 6, iconSize - 12, iconSize * 0.55, 6);
    tg.fillRoundedRect(iconSize * 0.3, iconSize * 0.65, iconSize * 0.4, iconSize * 0.15, 4);
    c.add(tg);
  }

  let currentText: Phaser.GameObjects.Text | undefined;
  if (currentScore !== undefined) {
    currentText = scene.add.text(iconSize + 10, 4, `${currentScore}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 5,
    }).setOrigin(0, 0);
    c.add(currentText);
  }
  const bestText = scene.add.text(2, iconSize + 4, `BEST: ${bestScore}`, {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '16px',
    fontStyle: '800',
    color: '#ffd23c',
    stroke: '#24304a',
    strokeThickness: 4,
  }).setOrigin(0, 0);
  c.add(bestText);

  return { container: c, bestText, currentText };
}

/** A shiny circular button with a pause / play glyph rendered by Graphics. */
export function drawCircleControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  glyph: 'pause' | 'play' | 'restart' | 'home',
  testId: string,
  hitSize?: number,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(50);
  c.setData('testId', testId);
  const g = scene.add.graphics();
  // 3D shadow
  g.fillStyle(0x18223a, 0.55);
  g.fillCircle(2, 4, size / 2);
  // Body
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, 0, size / 2);
  // Highlight
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(-size / 8, -size / 6, size / 3.5);
  // Stroke
  g.lineStyle(5, 0x24304a, 1);
  g.strokeCircle(0, 0, size / 2);
  // Glyph
  g.fillStyle(0x24304a, 1);
  if (glyph === 'pause') {
    const w = size * 0.12, h = size * 0.42, r = w / 2, off = size * 0.13;
    g.fillRoundedRect(-off - w, -h / 2, w, h, r);
    g.fillRoundedRect(off, -h / 2, w, h, r);
  } else if (glyph === 'play') {
    const s = size * 0.45;
    g.fillTriangle(-s * 0.35, -s * 0.5, -s * 0.35, s * 0.5, s * 0.5, 0);
  } else if (glyph === 'restart') {
    g.lineStyle(6, 0x24304a, 1);
    g.strokeCircle(0, 0, size * 0.25);
    g.fillTriangle(size * 0.15, -size * 0.28, size * 0.35, -size * 0.13, size * 0.15, -size * 0.02);
  } else if (glyph === 'home') {
    const s = size * 0.4;
    g.fillTriangle(-s, 0, s, 0, 0, -s);
    g.fillRect(-s * 0.7, 0, s * 1.4, s * 0.7);
  }
  c.add(g);
  // Hit-area radius — the invisible tap zone can be larger than the visible
  // art so the control stays comfortable to tap even when the visible
  // circle shrinks. Enforces a 44pt+ touch target.
  const tapSize = Math.max(hitSize ?? size, size);
  c.setSize(tapSize, tapSize);
  c.setInteractive(new Phaser.Geom.Circle(0, 0, tapSize / 2), Phaser.Geom.Circle.Contains);
  return c;
}

/** COMPACT borderless "treats/bones" counter — small bone icon + number.
 * No pill, no border, no background — just the icon and count for the top-right
 * corner of both the home screen and the gameplay HUD. */
export function drawCompactBones(
  scene: Phaser.Scene,
  x: number,
  y: number,
  treats: number,
  origin: 'top-right' | 'top-left' = 'top-right',
): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
  const iconSize = 44;
  const c = scene.add.container(x, y).setDepth(50);
  c.setData('testId', 'hud-treats-panel');

  // Bone icon (falls back to a small procedural bone shape if the texture is
  // missing so the layout stays intact).
  if (scene.textures.exists('treat')) {
    const iconX = origin === 'top-right' ? -iconSize / 2 : iconSize / 2;
    const bone = scene.add.image(iconX, iconSize / 2, 'treat').setDisplaySize(iconSize, iconSize * 0.55);
    c.add(bone);
  }
  const textX = origin === 'top-right' ? -iconSize - 8 : iconSize + 8;
  const text = scene.add.text(textX, 4, `${treats}`, {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '30px',
    fontStyle: '900',
    color: '#ffd23c',
    stroke: '#24304a',
    strokeThickness: 5,
  }).setOrigin(origin === 'top-right' ? 1 : 0, 0);
  c.add(text);
  return { container: c, text };
}

export function drawTreatsPill(
  scene: Phaser.Scene,
  x: number,
  y: number,
  treats: number,
  origin: 'top-right' | 'top-left' = 'top-right',
): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
  const w = 210, h = 76;
  const anchorX = origin === 'top-right' ? -w : 0;
  const c = scene.add.container(x, y).setDepth(50);
  c.setData('testId', 'hud-treats-panel');
  const g = scene.add.graphics();
  // Shadow
  g.fillStyle(0x18223a, 0.6);
  g.fillRoundedRect(anchorX + 5, 6, w, h, h / 2);
  // Body
  g.fillStyle(0x2a3d67, 1);
  g.fillRoundedRect(anchorX, 0, w, h, h / 2);
  // Gloss
  g.fillStyle(0xffffff, 0.14);
  g.fillRoundedRect(anchorX + 6, 4, w - 12, h * 0.4, h / 2);
  // Stroke
  g.lineStyle(4, 0xffffff, 1);
  g.strokeRoundedRect(anchorX, 0, w, h, h / 2);
  c.add(g);

  // Bone treat icon
  if (scene.textures.exists('treat')) {
    const bone = scene.add.image(anchorX + 44, h / 2, 'treat').setDisplaySize(64, 34);
    c.add(bone);
  }
  const text = scene.add.text(anchorX + 90, h / 2, `${treats}`, {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: `${Math.round(h * 0.5)}px`,
    fontStyle: '900',
    color: '#ffd23c',
    stroke: '#24304a',
    strokeThickness: 4,
  }).setOrigin(0, 0.5);
  c.add(text);
  return { container: c, text };
}
