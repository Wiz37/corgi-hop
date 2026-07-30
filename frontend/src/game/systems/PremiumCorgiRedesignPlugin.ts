import Phaser from 'phaser';
import { GAME_WIDTH } from '@/main';
import { CORGIS } from './GameState';
import { PolishedButton } from '@/game/ui/PolishedButton';

const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;
let installed = false;
let currentPage = 0;

type ThemeId = 'sunset' | 'forest' | 'mint' | 'berry' | 'shadow' | 'golden' | 'snow' | 'royal';

const SOURCES: Record<ThemeId, { portrait: string; run: string }> = {
  sunset: { portrait: 'corgi_starter', run: 'starter_run' },
  forest: { portrait: 'corgi_cowboy', run: 'cowboy_run' },
  mint: { portrait: 'corgi_astronaut', run: 'astronaut_run' },
  berry: { portrait: 'corgi_superhero', run: 'superhero_run' },
  shadow: { portrait: 'corgi_superhero', run: 'superhero_run' },
  golden: { portrait: 'corgi_pirate', run: 'pirate_run_fixed' },
  snow: { portrait: 'corgi_astronaut', run: 'astronaut_run' },
  royal: { portrait: 'corgi_pirate', run: 'pirate_run_fixed' },
};

const THEMES = Object.keys(SOURCES) as ThemeId[];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * (((bn - rn) / delta) + 2);
    else h = 60 * (((rn - gn) / delta) + 4);
  }
  if (h < 0) h += 360;
  return [h, max === 0 ? 0 : delta / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [Math.round((rp + m) * 255), Math.round((gp + m) * 255), Math.round((bp + m) * 255)];
}

function shift(h: number, s: number, v: number, targetHue: number, saturationScale = 1, valueScale = 1, saturationFloor = 0.35): [number, number, number] {
  return hsvToRgb(
    targetHue,
    Phaser.Math.Clamp(Math.max(saturationFloor, s * saturationScale), 0, 1),
    Phaser.Math.Clamp(v * valueScale, 0, 1),
  );
}

function recolor(theme: ThemeId, r: number, g: number, b: number, x: number, y: number, width: number, height: number): [number, number, number] {
  const [h, s, v] = rgbToHsv(r, g, b);
  const nx = x / width;
  const ny = y / height;
  const red = (h < 16 || h > 340) && s > 0.42 && v > 0.18;
  const blue = h > 175 && h < 245 && s > 0.28 && v > 0.2;
  const teal = h > 145 && h < 205 && s > 0.28 && v > 0.2;
  const gold = h > 30 && h < 68 && s > 0.35 && v > 0.35;

  if (theme === 'sunset') {
    if (teal) return shift(h, s, v, 348, 1.12, 0.96);
    if (gold) return shift(h, s, v, 48, 1.08, 1.05);
  }
  if (theme === 'forest') {
    if (red) return shift(h, s, v, 112, 0.95, 0.92);
    const hat = nx > 0.28 && ny < 0.48 && h > 8 && h < 42 && s > 0.35 && v > 0.18 && v < 0.73;
    if (hat) return shift(h, s, v, 94, 0.82, 0.9, 0.38);
  }
  if (theme === 'mint') {
    if (blue) return shift(h, s, v, 158, 0.9, 1.04);
    if (red) return shift(h, s, v, 350, 0.85, 1);
  }
  if (theme === 'berry') {
    if (blue) return shift(h, s, v, 292, 1, 0.98);
    if (red) return shift(h, s, v, 326, 1.05, 1.02);
  }
  if (theme === 'shadow') {
    if (blue) return shift(h, s, v, 224, 0.75, 0.58);
    if (red) return shift(h, s, v, 350, 0.85, 0.48);
  }
  if (theme === 'snow') {
    if (blue) return shift(h, s, v, 198, 0.6, 1.18);
    if (red) return shift(h, s, v, 190, 0.45, 1.1);
  }
  if (theme === 'golden' || theme === 'royal') {
    const hat = nx > 0.18 && ny < 0.48 && s < 0.38 && v > 0.09 && v < 0.46;
    if (hat) return shift(h, s, v, theme === 'golden' ? 8 : 258, 1.35, 0.95, 0.38);
    const patch = nx > 0.35 && ny < 0.55 && h > 5 && h < 40 && s > 0.18 && v > 0.12 && v < 0.55;
    if (patch) return shift(h, s, v, theme === 'golden' ? 350 : 286, 1.1, 0.92, 0.4);
    const emblem = nx > 0.42 && ny < 0.28 && s < 0.18 && v > 0.72;
    if (emblem) return shift(h, s, v, 45, 0.75, 0.92, 0.45);
  }
  return [r, g, b];
}

function rebuildTexture(scene: Phaser.Scene, sourceKey: string, targetKey: string, theme: ThemeId, runSheet: boolean): void {
  if (!scene.textures.exists(sourceKey)) return;
  if (scene.textures.exists(targetKey)) scene.textures.remove(targetKey);
  const sourceTexture = scene.textures.get(sourceKey);
  const source = sourceTexture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (!source?.width || !source?.height) return;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const localWidth = runSheet ? FRAME_W : canvas.width;
  const localHeight = runSheet ? FRAME_H : canvas.height;
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const index = (py * canvas.width + px) * 4;
      if (pixels[index + 3] === 0) continue;
      const localX = runSheet ? px % FRAME_W : px;
      const [nr, ng, nb] = recolor(theme, pixels[index], pixels[index + 1], pixels[index + 2], localX, py, localWidth, localHeight);
      pixels[index] = nr;
      pixels[index + 1] = ng;
      pixels[index + 2] = nb;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = scene.textures.addCanvas(targetKey, canvas);
  if (texture && runSheet) {
    for (let frame = 0; frame < FRAME_COUNT; frame++) texture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
  }
}

function rebuildPremiumCorgis(scene: Phaser.Scene): void {
  for (const theme of THEMES) {
    const source = SOURCES[theme];
    rebuildTexture(scene, source.portrait, `corgi_${theme}`, theme, false);
    rebuildTexture(scene, source.run, `${theme}_run`, theme, true);
    const animationKey = `${theme}_run`;
    if (scene.anims.exists(animationKey)) scene.anims.remove(animationKey);
    if (scene.textures.exists(animationKey)) {
      scene.anims.create({ key: animationKey, frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key: animationKey, frame })), frameRate: 14, repeat: -1 });
    }
  }
}

function installCleanPaging(CorgiSelectSceneClass: { prototype: object }): void {
  const proto = CorgiSelectSceneClass.prototype as any;
  const originalCreate = proto.create;
  proto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    const children = this.children?.list ?? [];
    for (const child of [...children]) {
      const id = (child as any)?.getData?.('testId');
      if (id === 'corgi-store-prev-page' || id === 'corgi-store-next-page' || id === 'corgi-store-page-indicator') child.destroy?.();
    }
    const perPage = 6;
    const pageCount = Math.max(1, Math.ceil(CORGIS.length / perPage));
    currentPage = Phaser.Math.Clamp(currentPage, 0, pageCount - 1);
    const indicator = this.add.text(GAME_WIDTH / 2, 1145, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(85).setData('testId', 'premium-store-page-indicator');
    const setInput = (object: any, enabled: boolean): void => { if (object?.input) object.input.enabled = enabled; };
    const refresh = (): void => {
      const currentChildren = this.children?.list ?? [];
      const start = currentPage * perPage;
      const items = CORGIS.slice(start, start + perPage);
      const sparse = items.length <= 2;
      CORGIS.forEach((corgi, index) => {
        const visibleIndex = index - start;
        const visible = visibleIndex >= 0 && visibleIndex < items.length;
        const card = currentChildren.find((child: any) => child?.getData?.('testId') === `select-corgi-${corgi.id}`) as Phaser.GameObjects.Container | undefined;
        const button = currentChildren.find((child: any) => child?.getData?.('testId') === `select-corgi-${corgi.id}-btn`) as Phaser.GameObjects.Container | undefined;
        card?.setVisible(visible).setActive(visible);
        button?.setVisible(visible).setActive(visible);
        setInput(card, visible);
        setInput(button, visible);
        if (!visible) return;
        const col = visibleIndex % 2;
        const row = Math.floor(visibleIndex / 2);
        const x = 195 + col * 330;
        const y = sparse ? 455 : 300 + row * 315;
        card?.setPosition(x, y);
        button?.setPosition(x, y + 128);
      });
      indicator.setText(`CORGIS  ${currentPage + 1} / ${pageCount}`);
    };
    new PolishedButton(this, {
      x: 150, y: 1145, w: 80, h: 58, label: '<', color: 0x2a3d67, shadowColor: 0x18223a, fontSize: 28, depth: 86, testId: 'premium-store-prev-page',
      onTap: () => { currentPage = currentPage <= 0 ? pageCount - 1 : currentPage - 1; refresh(); },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH - 150, y: 1145, w: 80, h: 58, label: '>', color: 0x2a3d67, shadowColor: 0x18223a, fontSize: 28, depth: 86, testId: 'premium-store-next-page',
      onTap: () => { currentPage = currentPage >= pageCount - 1 ? 0 : currentPage + 1; refresh(); },
    });
    refresh();
    return result;
  };
}

export function installPremiumCorgiRedesign(PreloadSceneClass: { prototype: object }, CorgiSelectSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;
  const preloadProto = PreloadSceneClass.prototype as any;
  const originalCreate = preloadProto.create;
  preloadProto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    rebuildPremiumCorgis(this);
    return result;
  };
  installCleanPaging(CorgiSelectSceneClass);
}
