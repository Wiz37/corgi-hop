import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';

type SceneClass = { prototype: Record<string, any> };
type Pose = 'run' | 'jump' | 'fall' | 'land' | 'hit';

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
}

interface PageTwoCorgi {
  id: string;
  frame: number;
  runAnimKey: string;
}

const STORE_PORTRAIT_SHEET = 'premium_store_portraits_page2_20260801';
const GAMEPLAY_ACTOR_DEPTH = 24;

const PAGE_TWO_CORGIS: PageTwoCorgi[] = [
  { id: 'blue_merle_chef', frame: 0, runAnimKey: 'blue_merle_chef_full_body_run_20260803' },
  { id: 'black_tri_tuxedo', frame: 1, runAnimKey: 'black_tri_tuxedo_full_body_run_20260803' },
  { id: 'red_tri_ninja', frame: 2, runAnimKey: 'red_tri_ninja_full_body_run_20260803' },
  { id: 'sable_aviator', frame: 3, runAnimKey: 'sable_aviator_full_body_run_20260803' },
  { id: 'brindle_viking', frame: 4, runAnimKey: 'brindle_viking_full_body_run_20260803' },
  { id: 'heeler_lifeguard', frame: 5, runAnimKey: 'heeler_lifeguard_full_body_run_20260803' },
];

const PAGE_TWO_BY_ID = new Map(PAGE_TWO_CORGIS.map((corgi) => [corgi.id, corgi]));
let installed = false;

function selectedPageTwoCorgi(): PageTwoCorgi | undefined {
  return PAGE_TWO_BY_ID.get(String((gameState as any).selectedCorgi ?? 'classic'));
}

function applyStorePortrait(id: string): void {
  const fullBody = PAGE_TWO_BY_ID.get(id);
  if (!fullBody) return;

  const definition = (CORGIS as unknown as RuntimeCorgiDef[])
    .find((candidate) => candidate.id === id);
  if (!definition) return;

  definition.texture = STORE_PORTRAIT_SHEET;
  definition.textureFrame = fullBody.frame;
}

function ensureStaticRunAnimation(scene: Phaser.Scene, fullBody: PageTwoCorgi): void {
  if (scene.anims.exists(fullBody.runAnimKey)) return;

  scene.anims.create({
    key: fullBody.runAnimKey,
    frames: [{ key: STORE_PORTRAIT_SHEET, frame: fullBody.frame }],
    frameRate: 1,
    repeat: -1,
  });
}

function applyFullBodyGameplay(
  scene: Phaser.Scene & Record<string, any>,
  fullBody: PageTwoCorgi,
): void {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi || !scene.textures.exists(STORE_PORTRAIT_SHEET)) return;

  const alreadyShowing =
    corgi.texture?.key === STORE_PORTRAIT_SHEET
    && String(corgi.frame?.name) === String(fullBody.frame);

  if (!alreadyShowing) {
    corgi.setTexture(STORE_PORTRAIT_SHEET, fullBody.frame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  // These padded portraits are the only page-two assets that preserve the
  // complete body. Clear every stale visual state that could crop, fade, flip,
  // mask, or place the dog behind the scenery.
  corgi.clearMask();
  corgi.setOrigin(0.5, 1);
  corgi.setDepth(GAMEPLAY_ACTOR_DEPTH);
  corgi.setVisible(true);
  corgi.setAlpha(1);
  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/**
 * Keeps all six page-two corgis full-bodied everywhere:
 * - store cards use the padded full-body portrait sheet, never cropped atlas rows;
 * - gameplay uses those same proven portraits for run/jump/fall/land/hit;
 * - the existing body bounce and jump physics still provide movement.
 */
export function installStoreFullBodyFix(
  CorgiSelectSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousBuildCard = selectPrototype.buildCard;

  selectPrototype.buildCard = function buildCardWithFullBodyPaws(
    this: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    id: string,
  ): unknown {
    if (this.textures.exists(STORE_PORTRAIT_SHEET)) applyStorePortrait(id);
    return previousBuildCard.call(this, x, y, width, height, id);
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithFullBodyPageTwoCorgi(
    this: Phaser.Scene & Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const result = previousGameCreate.apply(this, args);
    const fullBody = selectedPageTwoCorgi();
    if (!fullBody || !this.textures.exists(STORE_PORTRAIT_SHEET)) return result;

    ensureStaticRunAnimation(this, fullBody);
    this.runTexKey = STORE_PORTRAIT_SHEET;
    this.runAnimKey = fullBody.runAnimKey;

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    corgi?.anims.stop();
    applyFullBodyGameplay(this, fullBody);
    if (corgi && this.anims.exists(fullBody.runAnimKey)) corgi.play(fullBody.runAnimKey);
    if (typeof this.startRunBounce === 'function') this.startRunBounce();
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setFullBodyPageTwoPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const fullBody = selectedPageTwoCorgi();
    if (!fullBody || !this.textures.exists(STORE_PORTRAIT_SHEET)) {
      previousSetPose.call(this, pose);
      return;
    }

    ensureStaticRunAnimation(this, fullBody);
    this.runTexKey = STORE_PORTRAIT_SHEET;
    this.runAnimKey = fullBody.runAnimKey;
    applyFullBodyGameplay(this, fullBody);

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!corgi) return;

    if (pose === 'run') {
      const wrongAnimation = corgi.anims.currentAnim?.key !== fullBody.runAnimKey;
      if (this.anims.exists(fullBody.runAnimKey)
        && (!corgi.anims.isPlaying || wrongAnimation)) {
        corgi.play(fullBody.runAnimKey);
      }
    } else {
      corgi.anims.stop();
    }
  };
}
