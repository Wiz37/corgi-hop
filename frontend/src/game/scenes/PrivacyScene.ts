import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { services } from '@/services';
import { PolishedButton } from '@/game/ui/PolishedButton';
import { buildParallax, scatterMenuDecor } from '@/game/systems/Parallax';

/** Privacy / consent / restore-purchases management screen. */
export class PrivacyScene extends Phaser.Scene {
  constructor() { super('PrivacyScene'); }

  create(): void {
    buildParallax(this);
    scatterMenuDecor(this, 920);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.4).setDepth(24);

    this.add.text(GAME_WIDTH / 2, 100, 'PRIVACY & PURCHASES', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '44px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(30).setData('testId', 'privacy-title');

    // Explainer card
    const w = GAME_WIDTH - 60, h = 380;
    const cx = GAME_WIDTH / 2, cy = 350;
    const g = this.add.graphics().setDepth(28);
    g.fillStyle(0x18223a, 0.4);
    g.fillRoundedRect(cx - w / 2 + 4, cy - h / 2 + 6, w, h, 26);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 26);
    g.lineStyle(4, 0x24304a, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 26);

    const explainer =
      'Corgi Hop shows optional rewarded ads and occasional interstitial ads to keep the game free.\n\n' +
      '• Personalised ads and tracking are only requested after you tap Manage Privacy Choices.\n' +
      '• Remove Ads is a one-time purchase available in the Shop.\n' +
      '• Rewarded ads are always optional and give the reward only after the ad completes.\n' +
      '• You can restore previous purchases at any time.';
    this.add.text(cx, cy, explainer, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '19px', fontStyle: '600', color: '#24304a',
      wordWrap: { width: w - 60 }, align: 'center',
    }).setOrigin(0.5).setDepth(29);

    const status = services.consent.getStatus();
    this.add.text(GAME_WIDTH / 2, 610, `Consent status: ${status.toUpperCase()}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px', fontStyle: '800', color: '#ffd23c', stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30).setData('testId', 'privacy-status');

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: 720, w: 500, h: 100,
      label: 'MANAGE PRIVACY', color: 0xffb02f, shadowColor: 0xb26810,
      testId: 'privacy-manage',
      onTap: async () => { await services.consent.requestConsent(); this.scene.restart(); },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: 840, w: 500, h: 100,
      label: 'RESTORE PURCHASES', color: 0x4bb8ff, shadowColor: 0x1f6ea0,
      testId: 'privacy-restore',
      onTap: async () => {
        const r = await services.purchases.restore();
        this.toast(r.kind === 'success' ? 'Restore complete' : r.kind === 'unavailable' ? 'Unavailable in preview' : 'Restore failed');
      },
    });

    const privacyUrl = (import.meta as any).env?.VITE_PRIVACY_POLICY_URL || '#';
    const termsUrl   = (import.meta as any).env?.VITE_TERMS_URL || '#';
    this.linkText(GAME_WIDTH / 2 - 120, 970, 'PRIVACY POLICY', 'privacy-policy-link', privacyUrl);
    this.linkText(GAME_WIDTH / 2 + 120, 970, 'TERMS', 'terms-link', termsUrl);

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 90, w: 320, h: 100,
      label: 'BACK', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'privacy-back',
      onTap: () => this.scene.start('MenuScene'),
    });
  }

  private linkText(x: number, y: number, label: string, testId: string, url: string): void {
    const t = this.add.text(x, y, label, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '20px', fontStyle: '800',
      color: '#ffd23c', stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(31);
    t.setInteractive({ useHandCursor: true });
    t.setData('testId', testId);
    t.on('pointerup', () => {
      if (url && url !== '#') window.open(url, '_blank');
      else this.toast('Link not configured for preview');
    });
  }

  private toast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, msg, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '20px', fontStyle: '800',
      color: '#ffffff', backgroundColor: '#24304a', padding: { left: 12, right: 12, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1400, delay: 800, onComplete: () => t.destroy() });
  }
}
