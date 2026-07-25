import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { services } from '@/services';

/** Privacy / consent / restore-purchases management screen. */
export class PrivacyScene extends Phaser.Scene {
  constructor() { super('PrivacyScene'); }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xa8dcff).setDepth(0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_sky').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.6).setDepth(0);
    this.add.text(GAME_WIDTH / 2, 100, 'PRIVACY & PURCHASES', {
      fontFamily: 'system-ui', fontSize: '46px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'privacy-title');

    const explainer =
      'Corgi Hop shows optional rewarded ads and occasional interstitial ads to keep the game free.\n\n' +
      '• We only request personalised ads and (on iOS) tracking after you tap Manage Privacy Choices.\n' +
      '• You can remove all forced ads with a one-time Remove Ads purchase from the Shop.\n' +
      '• Rewarded ads are always optional and always give the reward only after the ad completes.\n' +
      '• You can restore previous purchases at any time.';
    this.add.text(GAME_WIDTH / 2, 380, explainer, {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: '600', color: '#24304a',
      wordWrap: { width: GAME_WIDTH - 80 }, align: 'center',
    }).setOrigin(0.5).setDepth(2);

    const status = services.consent.getStatus();
    this.add.text(GAME_WIDTH / 2, 660, `Consent status: ${status.toUpperCase()}`, {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: '800', color: '#4bb04b',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'privacy-status');

    this.mkBtn(GAME_WIDTH / 2, 780, 'MANAGE PRIVACY CHOICES', 'ui_button_gold', 'privacy-manage', async () => {
      await services.consent.requestConsent();
      this.scene.restart();
    });
    this.mkBtn(GAME_WIDTH / 2, 900, 'RESTORE PURCHASES', 'ui_button_blue', 'privacy-restore', async () => {
      const r = await services.purchases.restore();
      this.toast(r.kind === 'success' ? 'Restore complete' : r.kind === 'unavailable' ? 'Unavailable in preview' : 'Restore failed');
    });

    // Legal links (labelled with env override so the app can be built with real URLs)
    const privacyUrl = (import.meta as any).env?.VITE_PRIVACY_POLICY_URL || '#';
    const termsUrl   = (import.meta as any).env?.VITE_TERMS_URL || '#';
    this.linkText(GAME_WIDTH / 2 - 120, 1020, 'PRIVACY POLICY', 'privacy-policy-link', privacyUrl);
    this.linkText(GAME_WIDTH / 2 + 120, 1020, 'TERMS', 'terms-link', termsUrl);

    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT - 90, 'BACK', 'ui_button', 'privacy-back', () => this.scene.start('MenuScene'));
  }

  private linkText(x: number, y: number, label: string, testId: string, url: string): void {
    const t = this.add.text(x, y, label, {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: '800', color: '#3a7fd8',
    }).setOrigin(0.5).setDepth(3);
    t.setInteractive({ useHandCursor: true });
    t.setData('testId', testId);
    t.on('pointerup', () => {
      if (url && url !== '#') window.open(url, '_blank');
      else this.toast('Link not configured for preview');
    });
  }

  private toast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 190, msg, {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: '800', color: '#ffffff', backgroundColor: '#24304a',
      padding: { left: 12, right: 12, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1400, delay: 800, onComplete: () => t.destroy() });
  }

  private mkBtn(x: number, y: number, label: string, tex: string, testId: string, onTap: () => void) {
    const c = this.add.container(x, y).setDepth(3);
    const img = this.add.image(0, 0, tex).setDisplaySize(460, 100);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'system-ui', fontSize: '26px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([img, t]);
    c.setSize(460, 100).setInteractive(new Phaser.Geom.Rectangle(-230, -50, 460, 100), Phaser.Geom.Rectangle.Contains);
    c.setData('testId', testId);
    c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true }));
    c.on('pointerup', onTap);
    return c;
  }
}
