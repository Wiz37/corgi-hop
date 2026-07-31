import Phaser from 'phaser';

const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;
const THEMES = ['sunset', 'forest', 'mint', 'berry', 'shadow', 'golden', 'snow', 'royal'] as const;
type ThemeId = (typeof THEMES)[number];
let installed = false;

interface Anchors {
  headX: number; headY: number;
  neckX: number; neckY: number;
  backX: number; backY: number;
  chestX: number; chestY: number;
  tailX: number; tailY: number;
}

const BOB_X = [0, 2, 4, 2, -1, 1, 3, 1];
const BOB_Y = [0, -4, -7, -3, 1, -2, -6, -2];

function getAnchors(w: number, h: number, frame: number, portrait: boolean): Anchors {
  if (portrait) {
    return {
      headX: w * 0.685, headY: h * 0.34,
      neckX: w * 0.585, neckY: h * 0.535,
      backX: w * 0.39, backY: h * 0.555,
      chestX: w * 0.625, chestY: h * 0.665,
      tailX: w * 0.205, tailY: h * 0.515,
    };
  }
  const dx = BOB_X[frame % FRAME_COUNT];
  const dy = BOB_Y[frame % FRAME_COUNT];
  return {
    headX: w * 0.735 + dx, headY: h * 0.285 + dy,
    neckX: w * 0.625 + dx * 0.65, neckY: h * 0.505 + dy * 0.55,
    backX: w * 0.38, backY: h * 0.535 + dy * 0.28,
    chestX: w * 0.66, chestY: h * 0.655 + dy * 0.35,
    tailX: w * 0.19, tailY: h * 0.515 + dy * 0.2,
  };
}

function curve(ctx: CanvasRenderingContext2D, commands: Array<[string, ...number[]]>, fill: string | CanvasGradient, stroke: string, width: number): void {
  ctx.beginPath();
  for (const command of commands) {
    if (command[0] === 'M') ctx.moveTo(command[1], command[2]);
    else if (command[0] === 'L') ctx.lineTo(command[1], command[2]);
    else if (command[0] === 'Q') ctx.quadraticCurveTo(command[1], command[2], command[3], command[4]);
    else if (command[0] === 'C') ctx.bezierCurveTo(command[1], command[2], command[3], command[4], command[5], command[6]);
    else if (command[0] === 'Z') ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: string | CanvasGradient, stroke: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke: string, width: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, color: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function gradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colors: Array<[number, string]>): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [stop, color] of colors) g.addColorStop(stop, color);
  return g;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string, width: number, points = 5): void {
  const vertices: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = -Math.PI / 2 + Math.PI * i / points;
    vertices.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
  }
  polygon(ctx, vertices, fill, stroke, width);
}

function drawBack(ctx: CanvasRenderingContext2D, theme: ThemeId, w: number, h: number, frame: number, portrait: boolean): void {
  const a = getAnchors(w, h, frame, portrait);
  const dark = '#351021';
  const lw = Math.max(3, w * 0.011);

  if (theme === 'sunset') {
    const fill = gradient(ctx, a.tailX, a.backY, a.backX + w * 0.22, a.backY, [[0, '#ff665d'], [0.5, '#ffd45e'], [1, '#4fc7c7']]);
    curve(ctx, [['M', a.tailX - w * 0.07, a.backY + h * 0.02], ['Q', a.backX + w * 0.03, a.backY - h * 0.10, a.backX + w * 0.23, a.backY - h * 0.02], ['Q', a.backX + w * 0.24, a.backY + h * 0.06, a.backX + w * 0.04, a.backY + h * 0.14], ['Q', a.tailX - w * 0.08, a.backY + h * 0.10, a.tailX - w * 0.07, a.backY + h * 0.02], ['Z']], fill, dark, lw);
  } else if (theme === 'forest') {
    const fill = gradient(ctx, a.backX, a.backY, a.backX + w * 0.14, a.backY + h * 0.16, [[0, '#b8894e'], [1, '#5d3b23']]);
    curve(ctx, [['M', a.backX - w * 0.04, a.backY + h * 0.01], ['Q', a.backX + w * 0.08, a.backY - h * 0.04, a.backX + w * 0.14, a.backY + h * 0.07], ['L', a.backX + w * 0.10, a.backY + h * 0.17], ['Q', a.backX, a.backY + h * 0.18, a.backX - w * 0.04, a.backY + h * 0.10], ['Z']], fill, dark, lw);
  } else if (theme === 'mint') {
    const fill = gradient(ctx, a.backX, a.backY, a.backX + w * 0.13, a.backY + h * 0.15, [[0, '#e6fff4'], [1, '#62c9a4']]);
    curve(ctx, [['M', a.backX - w * 0.035, a.backY + h * 0.03], ['Q', a.backX + w * 0.06, a.backY, a.backX + w * 0.13, a.backY + h * 0.055], ['L', a.backX + w * 0.11, a.backY + h * 0.145], ['Q', a.backX + w * 0.02, a.backY + h * 0.16, a.backX - w * 0.035, a.backY + h * 0.095], ['Z']], fill, dark, lw);
  } else if (theme === 'berry' || theme === 'golden' || theme === 'royal') {
    const colors = theme === 'berry' ? [[0, '#ffadd9'], [0.52, '#d94fa2'], [1, '#7f286f']] as Array<[number, string]> : theme === 'golden' ? [[0, '#e84a4e'], [0.55, '#a61933'], [1, '#5f0f25']] : [[0, '#8469e4'], [0.52, '#49319e'], [1, '#24175d']];
    const fill = gradient(ctx, a.neckX, a.neckY, a.tailX - w * 0.08, a.backY + h * 0.20, colors);
    curve(ctx, [['M', a.neckX - w * 0.025, a.neckY - h * 0.02], ['C', a.backX + w * 0.03, a.backY - h * 0.06, a.tailX + w * 0.02, a.backY + h * 0.08, a.tailX - w * 0.08, a.backY + h * 0.18], ['Q', a.backX - w * 0.02, a.backY + h * 0.23, a.neckX + w * 0.05, a.neckY + h * 0.08], ['Z']], fill, dark, lw);
  } else if (theme === 'shadow') {
    const fill = gradient(ctx, a.neckX, a.neckY, a.tailX - w * 0.13, a.backY + h * 0.14, [[0, '#74283f'], [1, '#17131d']]);
    curve(ctx, [['M', a.neckX - w * 0.02, a.neckY - h * 0.02], ['C', a.backX + w * 0.02, a.backY - h * 0.05, a.tailX - w * 0.03, a.backY + h * 0.03, a.tailX - w * 0.13, a.backY + h * 0.08], ['L', a.tailX - w * 0.08, a.backY + h * 0.15], ['C', a.backX - w * 0.01, a.backY + h * 0.10, a.neckX + w * 0.03, a.neckY + h * 0.05, a.neckX - w * 0.02, a.neckY - h * 0.02], ['Z']], fill, dark, lw);
  } else if (theme === 'snow') {
    for (const sign of [-1, 1]) {
      const fill = gradient(ctx, a.backX, a.backY, a.backX + sign * w * 0.22, a.backY + h * 0.10, [[0, '#ffffff'], [1, '#a9dcf5']]);
      curve(ctx, [['M', a.backX, a.backY + h * 0.015], ['C', a.backX + sign * w * 0.10, a.backY - h * 0.10, a.backX + sign * w * 0.23, a.backY - h * 0.015, a.backX + sign * w * 0.19, a.backY + h * 0.095], ['C', a.backX + sign * w * 0.15, a.backY + h * 0.165, a.backX + sign * w * 0.055, a.backY + h * 0.125, a.backX, a.backY + h * 0.015], ['Z']], fill, '#6b9dbc', lw * 0.8);
    }
  }
}

function drawFront(ctx: CanvasRenderingContext2D, theme: ThemeId, w: number, h: number, frame: number, portrait: boolean): void {
  const a = getAnchors(w, h, frame, portrait);
  const dark = '#351021';
  const lw = Math.max(3, w * 0.011);

  if (theme === 'sunset') {
    oval(ctx, a.headX - w * 0.062, a.headY - h * 0.015, w * 0.054, h * 0.037, '#dc6f9f', dark, lw * 0.7);
    oval(ctx, a.headX + w * 0.055, a.headY - h * 0.013, w * 0.052, h * 0.036, '#ffc56b', dark, lw * 0.7);
    line(ctx, [[a.headX - w * 0.008, a.headY - h * 0.015], [a.headX + w * 0.008, a.headY - h * 0.015]], dark, lw * 0.55);
    const colors = ['#ff6e78', '#ffd85e', '#62c77a', '#ff91cb'];
    for (let i = 0; i < 9; i++) {
      const angle = Math.PI * (i + 1) / 10;
      oval(ctx, a.neckX + Math.cos(angle) * w * 0.092, a.neckY + Math.sin(angle) * h * 0.052, w * 0.014, h * 0.013, colors[i % colors.length], dark, lw * 0.24);
    }
  } else if (theme === 'forest') {
    const hat = gradient(ctx, a.headX - w * 0.12, a.headY - h * 0.15, a.headX + w * 0.10, a.headY - h * 0.02, [[0, '#a7cf6d'], [1, '#4f813f']]);
    curve(ctx, [['M', a.headX - w * 0.10, a.headY - h * 0.025], ['Q', a.headX - w * 0.075, a.headY - h * 0.15, a.headX + w * 0.03, a.headY - h * 0.14], ['Q', a.headX + w * 0.11, a.headY - h * 0.10, a.headX + w * 0.09, a.headY - h * 0.025], ['Z']], hat, dark, lw * 0.9);
    curve(ctx, [['M', a.headX - w * 0.145, a.headY - h * 0.035], ['Q', a.headX, a.headY - h * 0.075, a.headX + w * 0.14, a.headY - h * 0.025], ['Q', a.headX + w * 0.03, a.headY + h * 0.005, a.headX - w * 0.145, a.headY - h * 0.035], ['Z']], '#78ad50', dark, lw * 0.75);
    curve(ctx, [['M', a.neckX - w * 0.085, a.neckY - h * 0.015], ['Q', a.neckX, a.neckY + h * 0.025, a.neckX + w * 0.085, a.neckY - h * 0.005], ['L', a.neckX, a.neckY + h * 0.085], ['Z']], '#4f9d59', dark, lw * 0.7);
    star(ctx, a.chestX + w * 0.025, a.chestY + h * 0.035, w * 0.019, '#f6cf62', '#6a482e', lw * 0.32);
  } else if (theme === 'mint') {
    curve(ctx, [['M', a.neckX - w * 0.075, a.neckY - h * 0.015], ['Q', a.chestX + w * 0.09, a.chestY - h * 0.025, a.chestX + w * 0.085, a.chestY + h * 0.125], ['Q', a.chestX - w * 0.055, a.chestY + h * 0.145, a.neckX - w * 0.075, a.neckY - h * 0.015], ['Z']], '#9de5ca', dark, lw * 0.85);
    curve(ctx, [['M', a.headX - w * 0.10, a.headY - h * 0.02], ['Q', a.headX, a.headY - h * 0.17, a.headX + w * 0.10, a.headY - h * 0.02], ['L', a.headX + w * 0.10, a.headY + h * 0.015], ['L', a.headX - w * 0.10, a.headY + h * 0.015], ['Z']], '#fbfffd', dark, lw * 0.8);
    line(ctx, [[a.headX, a.headY - h * 0.13], [a.headX, a.headY - h * 0.045]], '#ef5d69', lw * 0.7);
    line(ctx, [[a.headX - w * 0.035, a.headY - h * 0.088], [a.headX + w * 0.035, a.headY - h * 0.088]], '#ef5d69', lw * 0.7);
    line(ctx, [[a.neckX - w * 0.02, a.neckY], [a.chestX, a.chestY + h * 0.06]], '#344c55', lw * 0.5);
    oval(ctx, a.chestX, a.chestY + h * 0.065, w * 0.022, h * 0.02, '#dbeaf0', '#344c55', lw * 0.35);
  } else if (theme === 'berry') {
    polygon(ctx, [[a.headX - w * 0.115, a.headY - h * 0.03], [a.headX - w * 0.07, a.headY - h * 0.11], [a.headX - w * 0.025, a.headY - h * 0.065], [a.headX, a.headY - h * 0.15], [a.headX + w * 0.035, a.headY - h * 0.065], [a.headX + w * 0.08, a.headY - h * 0.115], [a.headX + w * 0.115, a.headY - h * 0.03]], '#ef88c0', dark, lw * 0.8);
    curve(ctx, [['M', a.neckX - w * 0.09, a.neckY - h * 0.015], ['Q', a.neckX, a.neckY + h * 0.03, a.neckX + w * 0.085, a.neckY - h * 0.005], ['L', a.neckX + w * 0.05, a.neckY + h * 0.055], ['Q', a.neckX, a.neckY + h * 0.085, a.neckX - w * 0.055, a.neckY + h * 0.05], ['Z']], '#e35ca6', dark, lw * 0.65);
    oval(ctx, a.chestX, a.chestY + h * 0.02, w * 0.026, h * 0.028, '#914bd8', '#5d246c', lw * 0.4);
  } else if (theme === 'shadow') {
    curve(ctx, [['M', a.headX - w * 0.135, a.headY - h * 0.005], ['Q', a.headX - w * 0.10, a.headY - h * 0.155, a.headX, a.headY - h * 0.14], ['Q', a.headX + w * 0.13, a.headY - h * 0.11, a.headX + w * 0.14, a.headY + h * 0.045], ['Q', a.headX, a.headY + h * 0.09, a.headX - w * 0.135, a.headY - h * 0.005], ['Z']], '#211c29', dark, lw * 0.9);
    curve(ctx, [['M', a.headX - w * 0.115, a.headY + h * 0.01], ['Q', a.headX, a.headY + h * 0.06, a.headX + w * 0.12, a.headY + h * 0.018], ['L', a.headX + w * 0.10, a.headY + h * 0.08], ['Q', a.headX, a.headY + h * 0.115, a.headX - w * 0.10, a.headY + h * 0.07], ['Z']], '#302739', dark, lw * 0.7);
    line(ctx, [[a.headX - w * 0.09, a.headY - h * 0.038], [a.headX + w * 0.09, a.headY - h * 0.038]], '#c13b54', lw * 0.65);
  } else if (theme === 'golden') {
    polygon(ctx, [[a.headX - w * 0.125, a.headY - h * 0.028], [a.headX - w * 0.09, a.headY - h * 0.14], [a.headX - w * 0.035, a.headY - h * 0.065], [a.headX, a.headY - h * 0.17], [a.headX + w * 0.04, a.headY - h * 0.065], [a.headX + w * 0.098, a.headY - h * 0.14], [a.headX + w * 0.125, a.headY - h * 0.028]], '#ffc83d', dark, lw * 0.9);
    curve(ctx, [['M', a.neckX - w * 0.095, a.neckY - h * 0.02], ['Q', a.neckX, a.neckY + h * 0.03, a.neckX + w * 0.095, a.neckY - h * 0.005], ['Q', a.neckX + w * 0.065, a.neckY + h * 0.075, a.neckX, a.neckY + h * 0.06], ['Q', a.neckX - w * 0.07, a.neckY + h * 0.075, a.neckX - w * 0.095, a.neckY - h * 0.02], ['Z']], '#fffdf5', dark, lw * 0.65);
    oval(ctx, a.chestX, a.chestY + h * 0.035, w * 0.032, h * 0.032, '#f5c74b', '#7a4917', lw * 0.4);
  } else if (theme === 'snow') {
    oval(ctx, a.headX, a.headY - h * 0.17, w * 0.11, h * 0.026, 'rgba(255,248,168,0.50)', '#d7b64b', lw * 0.5);
    curve(ctx, [['M', a.neckX - w * 0.095, a.neckY - h * 0.02], ['Q', a.neckX, a.neckY + h * 0.03, a.neckX + w * 0.085, a.neckY - h * 0.01], ['L', a.neckX + w * 0.02, a.neckY + h * 0.09], ['Z']], '#84d2ef', '#4c7590', lw * 0.7);
    star(ctx, a.chestX, a.chestY + h * 0.025, w * 0.028, '#ffffff', '#5791b2', lw * 0.38, 6);
  } else if (theme === 'royal') {
    curve(ctx, [['M', a.headX - w * 0.11, a.headY - h * 0.025], ['Q', a.headX - w * 0.04, a.headY - h * 0.24, a.headX + w * 0.045, a.headY - h * 0.10], ['Q', a.headX + w * 0.13, a.headY - h * 0.075, a.headX + w * 0.10, a.headY - h * 0.02], ['Z']], '#5d42b8', dark, lw * 0.9);
    curve(ctx, [['M', a.headX - w * 0.15, a.headY - h * 0.035], ['Q', a.headX, a.headY - h * 0.075, a.headX + w * 0.145, a.headY - h * 0.025], ['Q', a.headX + w * 0.03, a.headY + h * 0.012, a.headX - w * 0.15, a.headY - h * 0.035], ['Z']], '#6f52cd', dark, lw * 0.75);
    star(ctx, a.headX - w * 0.015, a.headY - h * 0.14, w * 0.018, '#ffe27b', '#4d3475', lw * 0.3);
    curve(ctx, [['M', a.neckX - w * 0.09, a.neckY - h * 0.02], ['Q', a.neckX, a.neckY + h * 0.03, a.neckX + w * 0.09, a.neckY - h * 0.005], ['L', a.neckX, a.neckY + h * 0.08], ['Z']], '#7459cc', dark, lw * 0.7);
    star(ctx, a.chestX, a.chestY + h * 0.03, w * 0.018, '#fff0a8', '#71521c', lw * 0.28);
  }
}

function applyScale(ctx: CanvasRenderingContext2D, w: number, h: number, portrait: boolean): void {
  const scale = portrait ? 1.18 : 1.04;
  const centerX = portrait ? w * 0.50 : w * 0.52;
  const baseline = portrait ? h * 0.89 : h * 0.94;
  ctx.translate(centerX, baseline);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -baseline);
}

function buildTexture(scene: Phaser.Scene, theme: ThemeId, sourceKey: string, targetKey: string, runSheet: boolean): void {
  if (!scene.textures.exists(sourceKey)) return;
  if (scene.textures.exists(targetKey)) scene.textures.remove(targetKey);
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (!source?.width || !source?.height) return;

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;

  if (runSheet) {
    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      ctx.save();
      ctx.translate(frame * FRAME_W, 0);
      ctx.beginPath();
      ctx.rect(0, 0, FRAME_W, FRAME_H);
      ctx.clip();
      applyScale(ctx, FRAME_W, FRAME_H, false);
      drawBack(ctx, theme, FRAME_W, FRAME_H, frame, false);
      ctx.drawImage(source, frame * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      drawFront(ctx, theme, FRAME_W, FRAME_H, frame, false);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, source.width, source.height);
    ctx.clip();
    applyScale(ctx, source.width, source.height, true);
    drawBack(ctx, theme, source.width, source.height, 0, true);
    ctx.drawImage(source, 0, 0);
    drawFront(ctx, theme, source.width, source.height, 0, true);
    ctx.restore();
  }

  const texture = scene.textures.addCanvas(targetKey, canvas);
  if (texture && runSheet) {
    for (let frame = 0; frame < FRAME_COUNT; frame++) texture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
  }
}

function rebuild(scene: Phaser.Scene): void {
  for (const theme of THEMES) {
    buildTexture(scene, theme, 'corgi_idle', `corgi_${theme}`, false);
    buildTexture(scene, theme, 'corgi_run', `${theme}_run`, true);
    if (scene.anims.exists(`${theme}_run`)) scene.anims.remove(`${theme}_run`);
    if (scene.textures.exists(`${theme}_run`)) {
      scene.anims.create({
        key: `${theme}_run`,
        frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key: `${theme}_run`, frame })),
        frameRate: 14,
        repeat: -1,
      });
    }
  }
}

export function installPremiumCorgiNormalization(PreloadSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;
  const proto = PreloadSceneClass.prototype as any;
  const originalCreate = proto.create;
  proto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    rebuild(this);
    return result;
  };
}
