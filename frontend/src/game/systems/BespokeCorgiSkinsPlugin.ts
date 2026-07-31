import Phaser from 'phaser';

const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;
let installed = false;

type ThemeId = 'sunset' | 'forest' | 'mint' | 'berry' | 'shadow' | 'golden' | 'snow' | 'royal';
const THEMES: ThemeId[] = ['sunset', 'forest', 'mint', 'berry', 'shadow', 'golden', 'snow', 'royal'];

interface Anchors {
  headX: number;
  headY: number;
  neckX: number;
  neckY: number;
  backX: number;
  backY: number;
  chestX: number;
  chestY: number;
}

const BOB_Y = [0, -4, -7, -3, 1, -2, -6, -2];
const BOB_X = [0, 2, 4, 2, -1, 1, 3, 1];

function anchors(width: number, height: number, frame = 0): Anchors {
  const sx = width / FRAME_W;
  const sy = height / FRAME_H;
  const dx = BOB_X[frame % FRAME_COUNT] * sx;
  const dy = BOB_Y[frame % FRAME_COUNT] * sy;
  return {
    headX: width * 0.69 + dx,
    headY: height * 0.21 + dy,
    neckX: width * 0.59 + dx * 0.6,
    neckY: height * 0.47 + dy * 0.55,
    backX: width * 0.34,
    backY: height * 0.40 + dy * 0.25,
    chestX: width * 0.61,
    chestY: height * 0.57 + dy * 0.35,
  };
}

function path(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: string | CanvasGradient, stroke: string, lineWidth: number): void {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function curve(ctx: CanvasRenderingContext2D, commands: Array<[string, ...number[]]>, fill: string | CanvasGradient, stroke: string, lineWidth: number): void {
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
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke: string, lineWidth: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, color: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, fill: string, stroke: string, lineWidth: number, points = 5): void {
  const vertices: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (Math.PI * i) / points;
    vertices.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
  }
  path(ctx, vertices, fill, stroke, lineWidth);
}

function gradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

function drawBack(ctx: CanvasRenderingContext2D, theme: ThemeId, width: number, height: number, frame: number): void {
  const a = anchors(width, height, frame);
  const lw = Math.max(3, width * 0.012);
  const dark = '#341021';

  if (theme === 'sunset') {
    const board = gradient(ctx, a.backX - width * 0.08, a.backY, a.backX + width * 0.18, a.backY, [[0, '#ff7b5f'], [0.55, '#ffcf66'], [1, '#55c8c5']]);
    curve(ctx, [
      ['M', a.backX - width * 0.08, a.backY + height * 0.01],
      ['Q', a.backX + width * 0.03, a.backY - height * 0.085, a.backX + width * 0.17, a.backY - height * 0.02],
      ['Q', a.backX + width * 0.20, a.backY + height * 0.05, a.backX + width * 0.06, a.backY + height * 0.12],
      ['Q', a.backX - width * 0.07, a.backY + height * 0.09, a.backX - width * 0.08, a.backY + height * 0.01],
      ['Z'],
    ], board, dark, lw * 0.85);
    line(ctx, [[a.backX + width * 0.005, a.backY - height * 0.045], [a.backX + width * 0.09, a.backY + height * 0.07]], '#fff7df', lw * 0.75);
  } else if (theme === 'forest') {
    const bag = gradient(ctx, a.backX - width * 0.04, a.backY, a.backX + width * 0.12, a.backY + height * 0.15, [[0, '#9b6f3e'], [1, '#5f3e24']]);
    curve(ctx, [
      ['M', a.backX - width * 0.03, a.backY + height * 0.02],
      ['Q', a.backX + width * 0.08, a.backY - height * 0.01, a.backX + width * 0.11, a.backY + height * 0.08],
      ['L', a.backX + width * 0.09, a.backY + height * 0.16],
      ['Q', a.backX + width * 0.01, a.backY + height * 0.18, a.backX - width * 0.04, a.backY + height * 0.11],
      ['Z'],
    ], bag, dark, lw * 0.8);
    line(ctx, [[a.backX + width * 0.01, a.backY + height * 0.07], [a.backX + width * 0.09, a.backY + height * 0.07]], '#d7aa66', lw * 0.5);
  } else if (theme === 'mint') {
    const pouch = gradient(ctx, a.backX - width * 0.02, a.backY + height * 0.03, a.backX + width * 0.12, a.backY + height * 0.14, [[0, '#d9fff0'], [1, '#62c9a3']]);
    ctx.save();
    ctx.translate(a.backX + width * 0.035, a.backY + height * 0.095);
    ctx.rotate(-0.15);
    ctx.fillStyle = pouch;
    ctx.strokeStyle = dark;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.roundRect(-width * 0.07, -height * 0.045, width * 0.14, height * 0.09, width * 0.018);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (theme === 'berry') {
    const cape = gradient(ctx, a.neckX - width * 0.02, a.neckY, a.backX - width * 0.08, a.backY + height * 0.2, [[0, '#ff9bd3'], [0.52, '#d94f9f'], [1, '#8f2e7c']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.02, a.neckY - height * 0.02],
      ['Q', a.backX + width * 0.02, a.backY - height * 0.04, a.backX - width * 0.10, a.backY + height * 0.16],
      ['Q', a.backX - width * 0.02, a.backY + height * 0.20, a.neckX + width * 0.03, a.neckY + height * 0.08],
      ['Z'],
    ], cape, dark, lw);
    line(ctx, [[a.backX - width * 0.055, a.backY + height * 0.12], [a.backX + width * 0.015, a.backY + height * 0.045]], '#ffd7ed', lw * 0.45);
  } else if (theme === 'shadow') {
    const scarf = gradient(ctx, a.neckX, a.neckY, a.backX - width * 0.19, a.backY + height * 0.13, [[0, '#5d2539'], [1, '#1f1823']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.01, a.neckY - height * 0.02],
      ['C', a.backX + width * 0.03, a.backY - height * 0.03, a.backX - width * 0.07, a.backY + height * 0.02, a.backX - width * 0.18, a.backY + height * 0.08],
      ['L', a.backX - width * 0.11, a.backY + height * 0.14],
      ['C', a.backX - width * 0.03, a.backY + height * 0.09, a.neckX + width * 0.02, a.neckY + height * 0.05, a.neckX - width * 0.01, a.neckY - height * 0.02],
      ['Z'],
    ], scarf, dark, lw);
  } else if (theme === 'golden') {
    const cape = gradient(ctx, a.neckX, a.neckY, a.backX - width * 0.12, a.backY + height * 0.2, [[0, '#d73546'], [0.55, '#9f1732'], [1, '#631127']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.02, a.neckY - height * 0.02],
      ['Q', a.backX + width * 0.02, a.backY - height * 0.05, a.backX - width * 0.12, a.backY + height * 0.16],
      ['Q', a.backX - width * 0.03, a.backY + height * 0.22, a.neckX + width * 0.05, a.neckY + height * 0.08],
      ['Z'],
    ], cape, dark, lw);
    line(ctx, [[a.backX - width * 0.09, a.backY + height * 0.15], [a.neckX + width * 0.025, a.neckY + height * 0.055]], '#f8d27c', lw * 0.8);
  } else if (theme === 'snow') {
    for (const sign of [-1, 1]) {
      const wing = gradient(ctx, a.backX, a.backY, a.backX + sign * width * 0.18, a.backY + height * 0.1, [[0, '#ffffff'], [1, '#bde8ff']]);
      curve(ctx, [
        ['M', a.backX, a.backY + height * 0.01],
        ['C', a.backX + sign * width * 0.08, a.backY - height * 0.09, a.backX + sign * width * 0.20, a.backY - height * 0.01, a.backX + sign * width * 0.16, a.backY + height * 0.08],
        ['C', a.backX + sign * width * 0.13, a.backY + height * 0.15, a.backX + sign * width * 0.05, a.backY + height * 0.12, a.backX, a.backY + height * 0.01],
        ['Z'],
      ], wing, '#6da9c9', lw * 0.75);
      line(ctx, [[a.backX + sign * width * 0.025, a.backY + height * 0.025], [a.backX + sign * width * 0.12, a.backY + height * 0.065]], '#d8f3ff', lw * 0.5);
    }
  } else if (theme === 'royal') {
    const cloak = gradient(ctx, a.neckX, a.neckY, a.backX - width * 0.13, a.backY + height * 0.2, [[0, '#6f57c9'], [0.55, '#3e2b89'], [1, '#241856']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.02, a.neckY - height * 0.02],
      ['Q', a.backX + width * 0.04, a.backY - height * 0.05, a.backX - width * 0.12, a.backY + height * 0.18],
      ['Q', a.backX - width * 0.01, a.backY + height * 0.22, a.neckX + width * 0.05, a.neckY + height * 0.07],
      ['Z'],
    ], cloak, dark, lw);
    star(ctx, a.backX - width * 0.035, a.backY + height * 0.085, width * 0.022, width * 0.009, '#ffe17a', '#5d437f', lw * 0.35);
    star(ctx, a.backX + width * 0.02, a.backY + height * 0.03, width * 0.014, width * 0.006, '#d5c6ff', '#5d437f', lw * 0.3);
  }
}

function drawFront(ctx: CanvasRenderingContext2D, theme: ThemeId, width: number, height: number, frame: number): void {
  const a = anchors(width, height, frame);
  const lw = Math.max(3, width * 0.012);
  const dark = '#341021';

  if (theme === 'sunset') {
    const lens = gradient(ctx, a.headX - width * 0.12, a.headY - height * 0.03, a.headX + width * 0.14, a.headY + height * 0.03, [[0, '#773a83'], [0.45, '#ff896f'], [1, '#ffd56a']]);
    oval(ctx, a.headX - width * 0.075, a.headY - height * 0.005, width * 0.066, height * 0.038, lens, dark, lw * 0.8);
    oval(ctx, a.headX + width * 0.072, a.headY - height * 0.005, width * 0.066, height * 0.038, lens, dark, lw * 0.8);
    line(ctx, [[a.headX - width * 0.01, a.headY - height * 0.004], [a.headX + width * 0.012, a.headY - height * 0.004]], dark, lw * 0.65);
    const flowers = ['#ff7466', '#ffd35c', '#72d482', '#ff9acb'];
    for (let i = -3; i <= 3; i++) {
      const x = a.neckX + i * width * 0.025;
      const y = a.neckY + Math.abs(i) * height * 0.005;
      oval(ctx, x, y, width * 0.017, height * 0.015, flowers[i + 3], dark, lw * 0.32);
    }
    star(ctx, a.chestX, a.chestY, width * 0.023, width * 0.011, '#fff1a8', '#b55c4a', lw * 0.4, 6);
  } else if (theme === 'forest') {
    const hat = gradient(ctx, a.headX - width * 0.14, a.headY - height * 0.13, a.headX + width * 0.12, a.headY, [[0, '#9ccf6a'], [1, '#4f843d']]);
    curve(ctx, [
      ['M', a.headX - width * 0.12, a.headY - height * 0.035],
      ['Q', a.headX - width * 0.08, a.headY - height * 0.15, a.headX + width * 0.05, a.headY - height * 0.12],
      ['Q', a.headX + width * 0.10, a.headY - height * 0.08, a.headX + width * 0.08, a.headY - height * 0.025],
      ['Z'],
    ], hat, dark, lw);
    curve(ctx, [
      ['M', a.headX - width * 0.15, a.headY - height * 0.04],
      ['Q', a.headX - width * 0.02, a.headY - height * 0.075, a.headX + width * 0.13, a.headY - height * 0.025],
      ['Q', a.headX + width * 0.03, a.headY + height * 0.005, a.headX - width * 0.15, a.headY - height * 0.04],
      ['Z'],
    ], '#78ad50', dark, lw * 0.8);
    line(ctx, [[a.headX - width * 0.055, a.headY - height * 0.083], [a.headX + width * 0.055, a.headY - height * 0.065]], '#d8ef9b', lw * 0.55);
    const scarf = gradient(ctx, a.neckX - width * 0.08, a.neckY - height * 0.02, a.neckX + width * 0.08, a.neckY + height * 0.07, [[0, '#357a4b'], [1, '#73be66']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.08, a.neckY - height * 0.02],
      ['Q', a.neckX, a.neckY + height * 0.01, a.neckX + width * 0.08, a.neckY - height * 0.01],
      ['L', a.neckX, a.neckY + height * 0.075],
      ['Z'],
    ], scarf, dark, lw * 0.75);
    line(ctx, [[a.neckX - width * 0.06, a.neckY - height * 0.03], [a.chestX + width * 0.03, a.chestY + height * 0.09]], '#7f5733', lw * 0.6);
    star(ctx, a.chestX + width * 0.02, a.chestY + height * 0.045, width * 0.018, width * 0.008, '#f7cf63', '#6b492e', lw * 0.35);
  } else if (theme === 'mint') {
    const vest = gradient(ctx, a.neckX - width * 0.08, a.neckY, a.chestX + width * 0.09, a.chestY + height * 0.12, [[0, '#f2fff9'], [0.5, '#a6eed2'], [1, '#55bf98']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.07, a.neckY - height * 0.02],
      ['Q', a.chestX + width * 0.08, a.chestY - height * 0.03, a.chestX + width * 0.08, a.chestY + height * 0.11],
      ['Q', a.chestX - width * 0.06, a.chestY + height * 0.14, a.neckX - width * 0.07, a.neckY - height * 0.02],
      ['Z'],
    ], vest, dark, lw * 0.9);
    curve(ctx, [
      ['M', a.headX - width * 0.095, a.headY - height * 0.03],
      ['Q', a.headX, a.headY - height * 0.16, a.headX + width * 0.09, a.headY - height * 0.03],
      ['L', a.headX + width * 0.09, a.headY + height * 0.005],
      ['L', a.headX - width * 0.095, a.headY + height * 0.005],
      ['Z'],
    ], '#f7fff9', dark, lw * 0.85);
    line(ctx, [[a.headX, a.headY - height * 0.12], [a.headX, a.headY - height * 0.045]], '#eb5d6a', lw * 0.75);
    line(ctx, [[a.headX - width * 0.032, a.headY - height * 0.082], [a.headX + width * 0.032, a.headY - height * 0.082]], '#eb5d6a', lw * 0.75);
    line(ctx, [[a.neckX - width * 0.02, a.neckY], [a.chestX, a.chestY + height * 0.06]], '#344c55', lw * 0.55);
    oval(ctx, a.chestX, a.chestY + height * 0.065, width * 0.02, height * 0.018, '#dbeaf0', '#344c55', lw * 0.4);
    line(ctx, [[a.chestX + width * 0.035, a.chestY + height * 0.015], [a.chestX + width * 0.035, a.chestY + height * 0.07]], '#ffffff', lw * 0.5);
    line(ctx, [[a.chestX + width * 0.015, a.chestY + height * 0.043], [a.chestX + width * 0.055, a.chestY + height * 0.043]], '#ffffff', lw * 0.5);
  } else if (theme === 'berry') {
    const tiara = gradient(ctx, a.headX - width * 0.11, a.headY - height * 0.14, a.headX + width * 0.11, a.headY - height * 0.03, [[0, '#ffd5ee'], [0.55, '#ff91c7'], [1, '#c94a9b']]);
    path(ctx, [
      [a.headX - width * 0.11, a.headY - height * 0.035],
      [a.headX - width * 0.065, a.headY - height * 0.105],
      [a.headX - width * 0.02, a.headY - height * 0.065],
      [a.headX, a.headY - height * 0.145],
      [a.headX + width * 0.035, a.headY - height * 0.065],
      [a.headX + width * 0.08, a.headY - height * 0.11],
      [a.headX + width * 0.11, a.headY - height * 0.035],
    ], tiara, dark, lw * 0.85);
    oval(ctx, a.headX, a.headY - height * 0.083, width * 0.017, height * 0.022, '#7d4bd4', dark, lw * 0.35);
    const collar = gradient(ctx, a.neckX - width * 0.085, a.neckY - height * 0.01, a.neckX + width * 0.08, a.neckY + height * 0.045, [[0, '#ffb9df'], [1, '#d94d9d']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.085, a.neckY - height * 0.01],
      ['Q', a.neckX, a.neckY + height * 0.035, a.neckX + width * 0.08, a.neckY - height * 0.005],
      ['L', a.neckX + width * 0.05, a.neckY + height * 0.045],
      ['Q', a.neckX, a.neckY + height * 0.075, a.neckX - width * 0.055, a.neckY + height * 0.04],
      ['Z'],
    ], collar, dark, lw * 0.7);
    oval(ctx, a.chestX, a.chestY + height * 0.02, width * 0.025, height * 0.027, '#8f49d8', '#5f246e', lw * 0.45);
    oval(ctx, a.chestX, a.chestY + height * 0.018, width * 0.01, height * 0.012, '#ffd9f2', '#ffffff', lw * 0.2);
  } else if (theme === 'shadow') {
    const hood = gradient(ctx, a.headX - width * 0.13, a.headY - height * 0.1, a.headX + width * 0.14, a.headY + height * 0.07, [[0, '#3b3148'], [0.5, '#211c29'], [1, '#0f0d13']]);
    curve(ctx, [
      ['M', a.headX - width * 0.13, a.headY - height * 0.005],
      ['Q', a.headX - width * 0.10, a.headY - height * 0.14, a.headX, a.headY - height * 0.13],
      ['Q', a.headX + width * 0.12, a.headY - height * 0.11, a.headX + width * 0.13, a.headY + height * 0.04],
      ['Q', a.headX, a.headY + height * 0.08, a.headX - width * 0.13, a.headY - height * 0.005],
      ['Z'],
    ], hood, dark, lw);
    curve(ctx, [
      ['M', a.headX - width * 0.11, a.headY + height * 0.005],
      ['Q', a.headX, a.headY + height * 0.055, a.headX + width * 0.12, a.headY + height * 0.015],
      ['L', a.headX + width * 0.10, a.headY + height * 0.075],
      ['Q', a.headX, a.headY + height * 0.11, a.headX - width * 0.10, a.headY + height * 0.065],
      ['Z'],
    ], '#302738', dark, lw * 0.75);
    line(ctx, [[a.headX - width * 0.09, a.headY - height * 0.035], [a.headX + width * 0.09, a.headY - height * 0.035]], '#bb334d', lw * 0.7);
    const armor = gradient(ctx, a.neckX - width * 0.07, a.neckY, a.chestX + width * 0.08, a.chestY + height * 0.1, [[0, '#4a4054'], [1, '#1d1922']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.06, a.neckY],
      ['Q', a.chestX + width * 0.08, a.chestY - height * 0.02, a.chestX + width * 0.07, a.chestY + height * 0.10],
      ['Q', a.chestX - width * 0.05, a.chestY + height * 0.13, a.neckX - width * 0.06, a.neckY],
      ['Z'],
    ], armor, dark, lw * 0.8);
  } else if (theme === 'golden') {
    const crown = gradient(ctx, a.headX - width * 0.12, a.headY - height * 0.15, a.headX + width * 0.12, a.headY - height * 0.02, [[0, '#fff1a3'], [0.5, '#ffc53c'], [1, '#d98b16']]);
    path(ctx, [
      [a.headX - width * 0.12, a.headY - height * 0.03],
      [a.headX - width * 0.085, a.headY - height * 0.13],
      [a.headX - width * 0.03, a.headY - height * 0.065],
      [a.headX, a.headY - height * 0.16],
      [a.headX + width * 0.04, a.headY - height * 0.065],
      [a.headX + width * 0.095, a.headY - height * 0.13],
      [a.headX + width * 0.12, a.headY - height * 0.03],
    ], crown, dark, lw);
    oval(ctx, a.headX - width * 0.055, a.headY - height * 0.065, width * 0.012, height * 0.015, '#e94359', dark, lw * 0.3);
    oval(ctx, a.headX, a.headY - height * 0.07, width * 0.013, height * 0.017, '#4a7bea', dark, lw * 0.3);
    oval(ctx, a.headX + width * 0.055, a.headY - height * 0.065, width * 0.012, height * 0.015, '#5ec06d', dark, lw * 0.3);
    const fur = gradient(ctx, a.neckX - width * 0.09, a.neckY - height * 0.015, a.neckX + width * 0.09, a.neckY + height * 0.05, [[0, '#fffaf0'], [1, '#e8d7bd']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.09, a.neckY - height * 0.015],
      ['Q', a.neckX, a.neckY + height * 0.025, a.neckX + width * 0.09, a.neckY - height * 0.005],
      ['Q', a.neckX + width * 0.06, a.neckY + height * 0.065, a.neckX, a.neckY + height * 0.055],
      ['Q', a.neckX - width * 0.065, a.neckY + height * 0.065, a.neckX - width * 0.09, a.neckY - height * 0.015],
      ['Z'],
    ], fur, dark, lw * 0.7);
    oval(ctx, a.chestX, a.chestY + height * 0.03, width * 0.03, height * 0.03, '#f4c64b', '#7c4a17', lw * 0.45);
  } else if (theme === 'snow') {
    oval(ctx, a.headX, a.headY - height * 0.15, width * 0.105, height * 0.025, 'rgba(255,247,165,0.45)', '#d8b74d', lw * 0.55);
    const scarf = gradient(ctx, a.neckX - width * 0.09, a.neckY - height * 0.02, a.neckX + width * 0.08, a.neckY + height * 0.08, [[0, '#e7f8ff'], [0.5, '#89d7f3'], [1, '#4ea8d5']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.09, a.neckY - height * 0.02],
      ['Q', a.neckX, a.neckY + height * 0.025, a.neckX + width * 0.08, a.neckY - height * 0.01],
      ['L', a.neckX + width * 0.02, a.neckY + height * 0.08],
      ['Z'],
    ], scarf, '#4d7690', lw * 0.75);
    star(ctx, a.chestX, a.chestY + height * 0.02, width * 0.026, width * 0.01, '#e9fbff', '#5ba9d0', lw * 0.4, 6);
    oval(ctx, a.headX - width * 0.115, a.headY - height * 0.025, width * 0.034, height * 0.052, '#eaf9ff', '#6da9c9', lw * 0.65);
    oval(ctx, a.headX + width * 0.115, a.headY - height * 0.025, width * 0.034, height * 0.052, '#eaf9ff', '#6da9c9', lw * 0.65);
  } else if (theme === 'royal') {
    const hat = gradient(ctx, a.headX - width * 0.14, a.headY - height * 0.22, a.headX + width * 0.13, a.headY, [[0, '#7d67d6'], [0.55, '#49368f'], [1, '#281d59']]);
    curve(ctx, [
      ['M', a.headX - width * 0.11, a.headY - height * 0.035],
      ['Q', a.headX - width * 0.04, a.headY - height * 0.10, a.headX - width * 0.01, a.headY - height * 0.23],
      ['Q', a.headX + width * 0.10, a.headY - height * 0.14, a.headX + width * 0.07, a.headY - height * 0.035],
      ['Z'],
    ], hat, dark, lw);
    curve(ctx, [
      ['M', a.headX - width * 0.15, a.headY - height * 0.04],
      ['Q', a.headX, a.headY - height * 0.08, a.headX + width * 0.15, a.headY - height * 0.035],
      ['Q', a.headX + width * 0.04, a.headY + height * 0.01, a.headX - width * 0.15, a.headY - height * 0.04],
      ['Z'],
    ], '#5b49ad', dark, lw * 0.85);
    star(ctx, a.headX - width * 0.005, a.headY - height * 0.14, width * 0.02, width * 0.008, '#ffe477', '#6d4f9a', lw * 0.35);
    star(ctx, a.headX + width * 0.04, a.headY - height * 0.08, width * 0.012, width * 0.005, '#d9c8ff', '#6d4f9a', lw * 0.3);
    const collar = gradient(ctx, a.neckX - width * 0.085, a.neckY - height * 0.01, a.neckX + width * 0.08, a.neckY + height * 0.05, [[0, '#8a6fe0'], [1, '#443087']]);
    curve(ctx, [
      ['M', a.neckX - width * 0.085, a.neckY - height * 0.01],
      ['Q', a.neckX, a.neckY + height * 0.03, a.neckX + width * 0.08, a.neckY - height * 0.005],
      ['L', a.neckX, a.neckY + height * 0.065],
      ['Z'],
    ], collar, dark, lw * 0.7);
    oval(ctx, a.chestX, a.chestY + height * 0.025, width * 0.025, height * 0.027, '#f5d76b', '#7d5b22', lw * 0.4);
    ctx.save();
    ctx.fillStyle = '#43317e';
    ctx.beginPath();
    ctx.arc(a.chestX + width * 0.006, a.chestY + height * 0.023, width * 0.013, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function buildTexture(scene: Phaser.Scene, theme: ThemeId, sourceKey: string, targetKey: string, runSheet: boolean): void {
  if (!scene.textures.exists(sourceKey)) return;
  if (scene.textures.exists(targetKey)) scene.textures.remove(targetKey);
  const sourceTexture = scene.textures.get(sourceKey);
  const source = sourceTexture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
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
      drawBack(ctx, theme, FRAME_W, FRAME_H, frame);
      ctx.restore();
      ctx.drawImage(source, frame * FRAME_W, 0, FRAME_W, FRAME_H, frame * FRAME_W, 0, FRAME_W, FRAME_H);
      ctx.save();
      ctx.translate(frame * FRAME_W, 0);
      drawFront(ctx, theme, FRAME_W, FRAME_H, frame);
      ctx.restore();
    }
  } else {
    drawBack(ctx, theme, source.width, source.height, 0);
    ctx.drawImage(source, 0, 0);
    drawFront(ctx, theme, source.width, source.height, 0);
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

export function installBespokeCorgiSkins(PreloadSceneClass: { prototype: object }): void {
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
