import Phaser from 'phaser';

const FRAME_W = 366;
const FRAME_H = 352;
const FRAME_COUNT = 8;
let installed = false;

/**
 * Creates a corrected Pirate run texture without adding any separate display
 * objects. The source sheet accidentally uses transparent pixels for the skull
 * emblem, so the scenery shows through. Only transparent regions fully enclosed
 * inside the hat are filled; the real background remains transparent.
 */
function buildFixedPirateTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists('pirate_run') || scene.textures.exists('pirate_run_fixed')) return;

  const sourceTexture = scene.textures.get('pirate_run');
  const source = sourceTexture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (!source?.width || !source?.height) return;

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  // Tight local box around the skull-and-crossbones in every frame.
  const boxLeft = 180;
  const boxTop = 20;
  const boxRight = 300;
  const boxBottom = 125;
  const boxWidth = boxRight - boxLeft;
  const boxHeight = boxBottom - boxTop;
  const actualFrames = Math.min(FRAME_COUNT, Math.floor(canvas.width / FRAME_W));

  for (let frame = 0; frame < actualFrames; frame++) {
    const frameX = frame * FRAME_W;
    const visited = new Uint8Array(boxWidth * boxHeight);
    const queue = new Int32Array(boxWidth * boxHeight);
    let head = 0;
    let tail = 0;

    const alphaAt = (x: number, y: number): number => {
      const globalX = frameX + boxLeft + x;
      const globalY = boxTop + y;
      return data[(globalY * canvas.width + globalX) * 4 + 3];
    };

    const enqueue = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= boxWidth || y >= boxHeight) return;
      const index = y * boxWidth + x;
      if (visited[index] || alphaAt(x, y) !== 0) return;
      visited[index] = 1;
      queue[tail++] = index;
    };

    // Mark transparent background connected to the repair-box boundary.
    for (let x = 0; x < boxWidth; x++) {
      enqueue(x, 0);
      enqueue(x, boxHeight - 1);
    }
    for (let y = 0; y < boxHeight; y++) {
      enqueue(0, y);
      enqueue(boxWidth - 1, y);
    }

    while (head < tail) {
      const index = queue[head++];
      const x = index % boxWidth;
      const y = Math.floor(index / boxWidth);
      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }

    // Transparent pixels not reached from an edge are enclosed by the hat.
    // These are the skull-and-crossbones holes; make them warm white and opaque.
    for (let y = 0; y < boxHeight; y++) {
      for (let x = 0; x < boxWidth; x++) {
        const localIndex = y * boxWidth + x;
        if (visited[localIndex] || alphaAt(x, y) !== 0) continue;
        const globalX = frameX + boxLeft + x;
        const globalY = boxTop + y;
        const pixel = (globalY * canvas.width + globalX) * 4;
        data[pixel] = 247;
        data[pixel + 1] = 241;
        data[pixel + 2] = 223;
        data[pixel + 3] = 255;
      }
    }
  }

  ctx.putImageData(image, 0, 0);
  const fixedTexture = scene.textures.addCanvas('pirate_run_fixed', canvas);
  if (!fixedTexture) return;
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    fixedTexture.add(frame, 0, frame * FRAME_W, 0, FRAME_W, FRAME_H);
  }
}

/** Install before Phaser creates PreloadScene instances. */
export function installPirateTextureRepair(PreloadSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;

  const proto = PreloadSceneClass.prototype as any;
  const originalCreate = proto.create;
  proto.create = function (...args: unknown[]) {
    buildFixedPirateTexture(this);
    const result = originalCreate.apply(this, args);

    if (!this.anims.exists('pirate_run_fixed') && this.textures.exists('pirate_run_fixed')) {
      this.anims.create({
        key: 'pirate_run_fixed',
        frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({
          key: 'pirate_run_fixed',
          frame,
        })),
        frameRate: 14,
        repeat: -1,
      });
    }
    return result;
  };
}
