import Phaser from 'phaser';
import { GAME_WIDTH } from '@/main';
import { CORGIS } from './GameState';
import { PolishedButton } from '@/game/ui/PolishedButton';

const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;
const OUTLINE = '#341021';
let installed = false;
let rememberedStorePage = 0;

type ThemeId = 'sunset' | 'mint' | 'shadow' | 'golden' | 'berry' | 'snow' | 'forest' | 'royal';
const THEMES: ThemeId[] = ['sunset', 'mint', 'shadow', 'golden', 'berry', 'snow', 'forest', 'royal'];

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, lineWidth: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: string, lineWidth: number): void {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, stroke: string, lineWidth: number): void {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawTheme(ctx: CanvasRenderingContext2D, theme: ThemeId, width: number, height: number, offsetX = 0): void {
  const headX = offsetX + width * 0.69;
  const headY = height * 0.21;
  const neckX = offsetX + width * 0.59;
  const neckY = height * 0.47;
  const backX = offsetX + width * 0.33;
  const backY = height * 0.39;
  const lw = Math.max(3, width * 0.012);

  if (theme === 'sunset') {
    ellipse(ctx, headX - width * 0.075, headY, width * 0.075, height * 0.045, '#3b6398', lw);
    ellipse(ctx, headX + width * 0.085, headY, width * 0.075, height * 0.045, '#3b6398', lw);
    line(ctx, [[headX, headY], [headX + width * 0.02, headY]], OUTLINE, lw);
    const lei = ['#ff7466', '#ffd04f', '#6bd078', '#ff8ac9'];
    for (let i = -5; i <= 5; i++) {
      const angle = Math.PI * (i + 5) / 10;
      const x = neckX + Math.cos(angle) * width * 0.09;
      const y = neckY + Math.sin(angle) * height * 0.035;
      ellipse(ctx, x, y, width * 0.014, height * 0.014, lei[(i + 5) % lei.length], Math.max(1, lw * 0.4));
    }
  } else if (theme === 'mint') {
    polygon(ctx, [[headX - width * 0.09, headY - height * 0.04], [headX, headY - height * 0.16], [headX + width * 0.09, headY - height * 0.04]], '#ffffff', lw);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(headX - width * 0.1, headY - height * 0.055, width * 0.2, height * 0.05);
    line(ctx, [[headX, headY - height * 0.13], [headX, headY - height * 0.065]], '#69d0a0', lw);
    line(ctx, [[headX - width * 0.025, headY - height * 0.095], [headX + width * 0.025, headY - height * 0.095]], '#69d0a0', lw);
    line(ctx, [[neckX - width * 0.05, neckY], [neckX - width * 0.03, neckY + height * 0.08]], '#22222a', lw * 0.75);
    line(ctx, [[neckX + width * 0.05, neckY], [neckX + width * 0.03, neckY + height * 0.08]], '#22222a', lw * 0.75);
    ellipse(ctx, neckX + width * 0.03, neckY + height * 0.085, width * 0.013, height * 0.013, '#dfe9f5', Math.max(1, lw * 0.35));
  } else if (theme === 'shadow') {
    ctx.fillStyle = '#2b2b34';
    ctx.fillRect(headX - width * 0.13, headY - height * 0.035, width * 0.25, height * 0.07);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.strokeRect(headX - width * 0.13, headY - height * 0.035, width * 0.25, height * 0.07);
    line(ctx, [[headX + width * 0.11, headY - height * 0.02], [headX + width * 0.22, headY - height * 0.08]], '#ed4350', lw);
    line(ctx, [[headX + width * 0.11, headY + height * 0.02], [headX + width * 0.23, headY + height * 0.08]], '#ed4350', lw);
    polygon(ctx, [[neckX - width * 0.05, neckY - height * 0.025], [neckX + width * 0.06, neckY], [neckX, neckY + height * 0.065]], '#35353d', lw * 0.7);
  } else if (theme === 'golden') {
    polygon(ctx, [[neckX, neckY - height * 0.03], [backX - width * 0.11, backY], [backX - width * 0.06, backY + height * 0.18], [neckX + width * 0.04, neckY + height * 0.07]], '#bf2a3c', lw);
    const crownY = headY - height * 0.13;
    polygon(ctx, [[headX - width * 0.11, crownY + height * 0.06], [headX - width * 0.07, crownY - height * 0.02], [headX - width * 0.02, crownY + height * 0.025], [headX, crownY - height * 0.055], [headX + width * 0.03, crownY + height * 0.025], [headX + width * 0.08, crownY - height * 0.02], [headX + width * 0.12, crownY + height * 0.06]], '#ffc240', lw);
    ellipse(ctx, headX, crownY + height * 0.035, width * 0.012, height * 0.012, '#4d7cff', Math.max(1, lw * 0.4));
  } else if (theme === 'berry') {
    const tiaraY = headY - height * 0.12;
    polygon(ctx, [[headX - width * 0.09, tiaraY + height * 0.04], [headX - width * 0.04, tiaraY - height * 0.015], [headX, tiaraY - height * 0.055], [headX + width * 0.04, tiaraY - height * 0.015], [headX + width * 0.09, tiaraY + height * 0.04]], '#ffcdf2', lw);
    ellipse(ctx, headX, tiaraY - height * 0.015, width * 0.012, height * 0.012, '#ff78b4', Math.max(1, lw * 0.4));
    polygon(ctx, [[neckX, neckY], [neckX - width * 0.09, neckY - height * 0.04], [neckX - width * 0.08, neckY + height * 0.04]], '#ff7bb4', lw * 0.75);
    polygon(ctx, [[neckX, neckY], [neckX + width * 0.09, neckY - height * 0.04], [neckX + width * 0.08, neckY + height * 0.04]], '#ff7bb4', lw * 0.75);
  } else if (theme === 'snow') {
    ellipse(ctx, headX, headY - height * 0.15, width * 0.1, height * 0.025, 'rgba(255,249,160,0.35)', lw);
    for (const sign of [-1, 1]) {
      polygon(ctx, [[backX, backY], [backX + sign * width * 0.13, backY - height * 0.04], [backX + sign * width * 0.17, backY + height * 0.06], [backX + sign * width * 0.06, backY + height * 0.12]], '#ffffff', lw * 0.75);
    }
  } else if (theme === 'forest') {
    ctx.fillStyle = '#72a85e';
    ctx.fillRect(headX - width * 0.1, headY - height * 0.12, width * 0.18, height * 0.07);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.strokeRect(headX - width * 0.1, headY - height * 0.12, width * 0.18, height * 0.07);
    polygon(ctx, [[headX - width * 0.14, headY - height * 0.055], [headX + width * 0.11, headY - height * 0.055], [headX + width * 0.04, headY - height * 0.015], [headX - width * 0.15, headY - height * 0.015]], '#91c673', lw * 0.75);
    polygon(ctx, [[neckX - width * 0.05, neckY - height * 0.03], [neckX + width * 0.06, neckY], [neckX, neckY + height * 0.06]], '#78b05c', lw * 0.75);
  } else if (theme === 'royal') {
    polygon(ctx, [[neckX, neckY - height * 0.03], [backX - width * 0.11, backY], [backX - width * 0.06, backY + height * 0.18], [neckX + width * 0.04, neckY + height * 0.07]], '#606cdf', lw);
    polygon(ctx, [[headX - width * 0.1, headY - height * 0.035], [headX + width * 0.06, headY - height * 0.035], [headX - width * 0.02, headY - height * 0.23]], '#5c6dde', lw);
    ctx.fillStyle = '#817ff2';
    ctx.fillRect(headX - width * 0.12, headY - height * 0.05, width * 0.2, height * 0.035);
    ellipse(ctx, headX - width * 0.02, headY - height * 0.14, width * 0.012, height * 0.012, '#fff078', Math.max(1, lw * 0.35));
  }
}

function buildPremiumTextures(scene: Phaser.Scene): void {
  const staticTexture = scene.textures.get('corgi_idle');
  const runTexture = scene.textures.get('corgi_run');
  const staticSource = staticTexture?.getSourceImage() as CanvasImageSource | undefined;
  const runSource = runTexture?.getSourceImage() as CanvasImageSource | undefined;
  const staticWidth = Number((staticSource as any)?.width) || 0;
  const staticHeight = Number((staticSource as any)?.height) || 0;
  const runWidth = Number((runSource as any)?.width) || 0;
  const runHeight = Number((runSource as any)?.height) || 0;
  if (!staticSource || !runSource || !staticWidth || !staticHeight || !runWidth || !runHeight) return;

  for (const theme of THEMES) {
    const staticKey = `corgi_${theme}`;
    if (!scene.textures.exists(staticKey)) {
      const canvas = document.createElement('canvas');
      canvas.width = staticWidth;
      canvas.height = staticHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(staticSource, 0, 0);
        drawTheme(ctx, theme, staticWidth, staticHeight);
        scene.textures.addCanvas(staticKey, canvas);
      }
    }

    const runKey = `${theme}_run`;
    if (!scene.textures.exists(runKey)) {
      const canvas = document.createElement('canvas');
      canvas.width = runWidth;
      canvas.height = runHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(runSource, 0, 0);
        for (let frame = 0; frame < FRAME_COUNT; frame++) drawTheme(ctx, theme, FRAME_W, FRAME_H, frame * FRAME_W);
        const texture = scene.textures.addCanvas(runKey, canvas);
        if (texture) {
          for (let frame = 0; frame < FRAME_COUNT; frame++) texture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
        }
      }
    }
  }
}

function addSun(scene: Phaser.Scene): void {
  const existing = (scene.children?.list ?? []).find((child: any) => child?.getData?.('testId') === 'sunny-background-sun');
  if (existing) return;
  const sun = scene.add.container(GAME_WIDTH - 135, 150).setDepth(0.75).setData('testId', 'sunny-background-sun');
  const glow = scene.add.graphics();
  glow.fillStyle(0xfff5b8, 0.22); glow.fillCircle(0, 0, 92);
  glow.fillStyle(0xffef8f, 0.36); glow.fillCircle(0, 0, 66);
  glow.fillStyle(0xffd95c, 1); glow.fillCircle(0, 0, 43);
  glow.lineStyle(5, 0xffc84a, 0.9); glow.strokeCircle(0, 0, 43);
  sun.add(glow);
}

function installStorePaging(CorgiSelectSceneClass: { prototype: object }): void {
  const proto = CorgiSelectSceneClass.prototype as any;
  const originalCreate = proto.create;
  proto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    const perPage = 6;
    const pageCount = Math.max(1, Math.ceil(CORGIS.length / perPage));
    rememberedStorePage = Phaser.Math.Clamp(rememberedStorePage, 0, pageCount - 1);
    const indicator = this.add.text(GAME_WIDTH / 2, 174, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(45).setData('testId', 'corgi-store-page-indicator');
    const setInput = (object: any, enabled: boolean): void => { if (object?.input) object.input.enabled = enabled; };
    const refresh = (): void => {
      const children = this.children?.list ?? [];
      CORGIS.forEach((corgi, index) => {
        const visibleIndex = index - rememberedStorePage * perPage;
        const visible = visibleIndex >= 0 && visibleIndex < perPage;
        const card = children.find((child: any) => child?.getData?.('testId') === `select-corgi-${corgi.id}`) as Phaser.GameObjects.Container | undefined;
        const button = children.find((child: any) => child?.getData?.('testId') === `select-corgi-${corgi.id}-btn`) as Phaser.GameObjects.Container | undefined;
        if (card) { card.setVisible(visible).setActive(visible); setInput(card, visible); }
        if (button) { button.setVisible(visible).setActive(visible); setInput(button, visible); }
        if (!visible) return;
        const col = visibleIndex % 2;
        const row = Math.floor(visibleIndex / 2);
        const x = 195 + col * 330;
        const y = 250 + row * 350;
        card?.setPosition(x, y);
        button?.setPosition(x, y + 128);
      });
      indicator.setText(`CORGIS  ${rememberedStorePage + 1} / ${pageCount}`);
    };
    new PolishedButton(this, { x: 92, y: 174, w: 90, h: 62, label: '<', color: 0x2a3d67, shadowColor: 0x18223a, fontSize: 30, depth: 46, testId: 'corgi-store-prev-page', onTap: () => { rememberedStorePage = rememberedStorePage <= 0 ? pageCount - 1 : rememberedStorePage - 1; refresh(); } });
    new PolishedButton(this, { x: GAME_WIDTH - 92, y: 174, w: 90, h: 62, label: '>', color: 0x2a3d67, shadowColor: 0x18223a, fontSize: 30, depth: 46, testId: 'corgi-store-next-page', onTap: () => { rememberedStorePage = rememberedStorePage >= pageCount - 1 ? 0 : rememberedStorePage + 1; refresh(); } });
    refresh();
    return result;
  };
}

export function installPremiumCorgiPolish(PreloadSceneClass: { prototype: object }, GameSceneClass: { prototype: object }, MenuSceneClass: { prototype: object }, HUDSceneClass: { prototype: object }, CorgiSelectSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;
  const preloadProto = PreloadSceneClass.prototype as any;
  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function (...args: unknown[]) {
    buildPremiumTextures(this);
    const result = originalPreloadCreate.apply(this, args);
    for (const theme of THEMES) {
      const key = `${theme}_run`;
      if (!this.anims.exists(key) && this.textures.exists(key)) {
        this.anims.create({ key, frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key, frame })), frameRate: 14, repeat: -1 });
      }
    }
    return result;
  };
  const menuProto = MenuSceneClass.prototype as any;
  if (typeof menuProto.buildRain === 'function') menuProto.buildRain = function () {};
  const originalMenuCreate = menuProto.create;
  menuProto.create = function (...args: unknown[]) {
    const result = originalMenuCreate.apply(this, args);
    addSun(this);
    for (const child of [...(this.children?.list ?? [])]) if ((child as any)?.texture?.key === 'menu_rain_drop') child.destroy?.();
    const corgi = this.corgi as Phaser.GameObjects.Sprite | undefined;
    if (corgi) this.tweens.add({ targets: corgi, angle: { from: -2.1, to: 2.1 }, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return result;
  };
  const gameProto = GameSceneClass.prototype as any;
  const originalGameCreate = gameProto.create;
  gameProto.create = function (...args: unknown[]) { const result = originalGameCreate.apply(this, args); addSun(this); return result; };
  gameProto.startRunBounce = function () {
    if (this.runBounceTween?.isPlaying?.() || !this.corgi || this.baseScale <= 0) return;
    const stridePixels = Math.max(1, Number(this.STRIDE_PIX) || 28);
    const fps = Math.max(10, this.currentRunFps || this.gameSpeed / stridePixels);
    const halfCycleMs = Math.max(70, 1800 / fps);
    this.runBounceTween = this.tweens.add({ targets: this.corgi, scaleX: this.baseScale * 1.035, scaleY: this.baseScale * 0.955, duration: halfCycleMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  };
  const originalApplyRunBob = gameProto.applyRunBob;
  gameProto.applyRunBob = function (...args: unknown[]) {
    const result = originalApplyRunBob?.apply(this, args);
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    const body = corgi?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!corgi || !body) return result;
    const grounded = corgi.y >= this.groundY - 8 && Math.abs(body.velocity.y) < 24;
    if (grounded) { const phase = Number(this.runBobPhase) || 0; corgi.setAngle(Math.sin(phase + Math.PI / 4) * 2.3); corgi.y -= Math.max(0, Math.sin(phase)) * 1.5; } else corgi.setAngle(0);
    return result;
  };
  const originalStopRunBounce = gameProto.stopRunBounce;
  gameProto.stopRunBounce = function (...args: unknown[]) { const result = originalStopRunBounce?.apply(this, args); this.corgi?.setAngle?.(0); return result; };
  const hudProto = HUDSceneClass.prototype as any;
  const originalHudCreate = hudProto.create;
  hudProto.create = function (...args: unknown[]) {
    const result = originalHudCreate.apply(this, args);
    const pause = (this.children?.list ?? []).find((child: any) => child?.getData?.('testId') === 'hud-pause-button') as Phaser.GameObjects.Container | undefined;
    if (!pause) return result;
    pause.disableInteractive();
    const pauseHit = this.add.zone(pause.x, pause.y, 148, 148).setDepth(90).setInteractive({ useHandCursor: true }).setData('testId', 'hud-pause-button-fixed-hit');
    let pausing = false;
    pauseHit.on('pointerdown', () => {
      if (pausing) return;
      pausing = true;
      this.tweens.add({ targets: pause, scale: 0.9, duration: 60, yoyo: true });
      this.scene.pause('GameScene');
      this.scene.launch('PauseScene');
      this.time.delayedCall(250, () => { pausing = false; });
    });
    return result;
  };
  installStorePaging(CorgiSelectSceneClass);
}
