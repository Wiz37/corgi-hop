import { achievements, type AchievementDef } from './Achievements';
import { gameState } from './GameState';

type SceneClass = { prototype: Record<string, any> };

let installed = false;

function rewardAchievement(scene: any, id: string): AchievementDef | null {
  const unlocked = achievements.unlock(id);
  if (!unlocked) return null;

  if (unlocked.reward > 0) {
    gameState.addTreats(unlocked.reward);
    scene.events.emit('treatsChanged', gameState.treats);
  }

  scene.events.emit('achievementUnlocked', unlocked);
  scene.events.emit('skillFeedback', {
    text: `BADGE! ${unlocked.label}  +${unlocked.reward}`,
    tint: 0x8ee65e,
  });

  // Achievement rewards count as earned Bones. If another badge reward pushes
  // the lifetime total over 500, award Bone Hound immediately as well.
  if (id !== 'bone-hound' && gameState.totalTreatsEarned >= 500) {
    rewardAchievement(scene, 'bone-hound');
  }

  return unlocked;
}

function checkRunMilestones(scene: any): void {
  const score = Math.max(0, Number(scene.score) || 0);
  if (score >= 1) rewardAchievement(scene, 'first-hop');
  if (gameState.bestStreak >= 10) rewardAchievement(scene, 'hot-paws');
  if (score >= 25) rewardAchievement(scene, 'park-pro');
  if (score >= 50) rewardAchievement(scene, 'half-century');
  if (score >= 100) rewardAchievement(scene, 'corgi-legend');
  if (gameState.totalTreatsEarned >= 500) rewardAchievement(scene, 'bone-hound');
}

function addBadgePill(scene: any, y: number, testId: string): void {
  const x = Number(scene.scale?.gameSize?.width || 720) / 2;
  const width = 250;
  const height = 44;
  const graphics = scene.add.graphics().setDepth(44);
  graphics.fillStyle(0x24304a, 0.78);
  graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
  graphics.lineStyle(3, 0xffd23c, 0.95);
  graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
  scene.add.text(x, y, `★ ${achievements.getProgressText()}`, {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '20px',
    fontStyle: '900',
    color: '#ffffff',
    stroke: '#24304a',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(45).setData('testId', testId);
}

function installBadgeProgressUi(MenuSceneClass?: SceneClass, GameOverSceneClass?: SceneClass): void {
  if (MenuSceneClass) {
    const menuProto = MenuSceneClass.prototype as any;
    const originalMenuCreate = menuProto.create;
    if (typeof originalMenuCreate === 'function') {
      menuProto.create = function createMenuWithBadgeProgress(...args: unknown[]) {
        const result = originalMenuCreate.apply(this, args);
        addBadgePill(this, 980, 'menu-badge-progress');
        return result;
      };
    }
  }

  if (GameOverSceneClass) {
    const gameOverProto = GameOverSceneClass.prototype as any;
    const originalGameOverCreate = gameOverProto.create;
    if (typeof originalGameOverCreate === 'function') {
      gameOverProto.create = function createGameOverWithBadgeProgress(...args: unknown[]) {
        const result = originalGameOverCreate.apply(this, args);
        const height = Number(this.scale?.gameSize?.height || 1280);
        addBadgePill(this, height / 2 + 18, 'gameover-badge-progress');
        return result;
      };
    }
  }
}

/**
 * Final progression pass for Corgi Hop.
 *
 * This deliberately wraps existing gameplay callbacks instead of changing
 * jump physics, obstacle spacing, or the validated hurdle generator. Badges
 * are permanent, reward a modest number of Bones, and surface through the
 * existing skill-feedback HUD so the game gets a longer-term chase without
 * destabilising the TestFlight balance.
 */
export function installAchievementRewards(
  GameSceneClass: SceneClass,
  MenuSceneClass?: SceneClass,
  GameOverSceneClass?: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const proto = GameSceneClass.prototype as any;

  const originalObstaclePassed = proto.onObstaclePassed;
  if (typeof originalObstaclePassed === 'function') {
    proto.onObstaclePassed = function achievementObstaclePassed(...args: unknown[]) {
      const result = originalObstaclePassed.apply(this, args);
      checkRunMilestones(this);
      return result;
    };
  }

  const originalCollectTreat = proto.collectTreat;
  if (typeof originalCollectTreat === 'function') {
    proto.collectTreat = function achievementTreatCollected(...args: unknown[]) {
      const result = originalCollectTreat.apply(this, args);
      if (gameState.totalTreatsEarned >= 500) rewardAchievement(this, 'bone-hound');
      return result;
    };
  }

  installBadgeProgressUi(MenuSceneClass, GameOverSceneClass);
}
