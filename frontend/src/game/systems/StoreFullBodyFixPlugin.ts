import Phaser from 'phaser';
import { CORGIS } from './GameState';

type SceneClass = { prototype: Record<string, any> };

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  tint?: number;
}

const CARD_TEST_ID_PREFIX = 'select-corgi-';
const STATIC_STOCK_STORE_IDS = new Set([
  'classic',
  'starter',
  'cowboy',
  'superhero',
  'pirate',
  'astronaut',
  'heeler_lifeguard',
]);
let installed = false;

function stockPortraitAsset(
  scene: Phaser.Scene,
  definition: RuntimeCorgiDef,
): { texture: string; frame?: number } {
  // Character-select cards always use static stock portraits. Running sheets
  // and animations are reserved exclusively for live gameplay.
  if (scene.textures.exists(definition.texture)) {
    return {
      texture: definition.texture,
      frame: definition.textureFrame,
    };
  }

  return { texture: 'corgi_idle' };
}

function cardCorgiId(card: Phaser.GameObjects.Container): string | undefined {
  const testId = String(card.getData('testId') ?? '');
  if (!testId.startsWith(CARD_TEST_ID_PREFIX) || testId.endsWith('-btn')) return undefined;
  return testId.slice(CARD_TEST_ID_PREFIX.length);
}

function replaceCardPortrait(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  definition: RuntimeCorgiDef,
  phase: number,
): void {
  const currentPortrait = card.list.find((child) =>
    child instanceof Phaser.GameObjects.Image,
  ) as Phaser.GameObjects.Image | undefined;
  if (!currentPortrait) return;

  const asset = stockPortraitAsset(scene, definition);
  const index = card.getIndex(currentPortrait);
  const width = currentPortrait.displayWidth;
  const height = currentPortrait.displayHeight;
  const x = currentPortrait.x;
  const y = currentPortrait.y;
  const alpha = currentPortrait.alpha;
  const depth = currentPortrait.depth;

  card.remove(currentPortrait, true);

  const sprite = scene.add.sprite(x, y, asset.texture, asset.frame)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setFlipX(false)
    .setAngle(0)
    .setDepth(depth);

  if (definition.tint !== undefined) sprite.setTint(definition.tint);
  if (index >= 0) card.addAt(sprite, index);
  else card.add(sprite);

}

function animateVisibleStoreCards(scene: Phaser.Scene): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];
  const cards = scene.children.list.filter((child) =>
    child instanceof Phaser.GameObjects.Container
    && cardCorgiId(child as Phaser.GameObjects.Container),
  ) as Phaser.GameObjects.Container[];

  cards.forEach((card, index) => {
    const id = cardCorgiId(card);
    const definition = definitions.find((candidate) => candidate.id === id);
    if (!definition) return;
    replaceCardPortrait(scene, card, definition, index / Math.max(1, cards.length));
  });
}

/**
 * Uses each corgi's dedicated static stock portrait on character-select cards.
 * No store portrait plays a running animation; run sheets remain exclusively
 * owned by gameplay. Gameplay behavior is intentionally untouched here.
 */
export function installStoreFullBodyFix(
  CorgiSelectSceneClass: SceneClass,
  _GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousCreate = selectPrototype.create;

  selectPrototype.create = function createAnimatedCorgiStore(
    this: Phaser.Scene & Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const result = previousCreate.apply(this, args);
    animateVisibleStoreCards(this);
    return result;
  };
}
