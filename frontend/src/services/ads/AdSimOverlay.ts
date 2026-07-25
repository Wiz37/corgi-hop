// AdSimOverlay — a *browser-only* simulated ad overlay used by AdService when
// running outside a native Capacitor build. It is intentionally styled as
// a clearly-labelled TEST AD and is NOT a real advertising unit.
//
// The overlay is a plain DOM element rendered *above* the Phaser canvas
// so it visually resembles what a real interstitial/rewarded ad would look
// like on device, but it never contacts an ad network.

import type { RewardKind } from './AdService';

const REWARD_COPY: Record<RewardKind, { title: string; subtitle: string }> = {
  revive: { title: 'REVIVE!', subtitle: 'Watch a short ad to keep running' },
  double_treats: { title: '2x TREATS', subtitle: 'Watch a short ad to double this run\'s treats' },
  bonus_treats: { title: '+25 TREATS', subtitle: 'Watch a short ad for 25 treats' },
  trial_corgi: { title: 'TRY IT!', subtitle: 'Watch a short ad to try this corgi for one run' },
};

function makeRoot(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'ad-sim-overlay');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '9999',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
    textAlign: 'center',
  } as CSSStyleDeclaration);
  return el;
}

function makeLabel(text: string, size: number, weight: string, color = '#fff'): HTMLDivElement {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.fontSize = `${size}px`;
  d.style.fontWeight = weight;
  d.style.color = color;
  d.style.margin = '6px 0';
  d.style.letterSpacing = '1px';
  return d;
}

function makeButton(label: string, testId: string, primary = true): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.setAttribute('data-testid', testId);
  Object.assign(b.style, {
    marginTop: '16px',
    padding: '14px 28px',
    fontSize: '18px',
    fontWeight: '700',
    borderRadius: '999px',
    border: 'none',
    background: primary ? '#ffd23c' : 'rgba(255,255,255,0.15)',
    color: primary ? '#3a2a00' : '#fff',
    cursor: 'pointer',
    minWidth: '220px',
  } as CSSStyleDeclaration);
  return b;
}

function makeTestBadge(): HTMLDivElement {
  const badge = document.createElement('div');
  badge.textContent = 'TEST AD (browser preview)';
  badge.setAttribute('data-testid', 'ad-sim-test-badge');
  Object.assign(badge.style, {
    position: 'absolute',
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#ff5555',
    color: '#fff',
    fontWeight: '800',
    letterSpacing: '2px',
    padding: '6px 14px',
    borderRadius: '999px',
    fontSize: '12px',
  } as CSSStyleDeclaration);
  return badge;
}

export const AdSimOverlay = {
  showRewarded(kind: RewardKind): Promise<boolean> {
    return new Promise((resolve) => {
      const copy = REWARD_COPY[kind];
      const root = makeRoot();
      root.appendChild(makeTestBadge());
      root.appendChild(makeLabel(copy.title, 42, '900'));
      root.appendChild(makeLabel(copy.subtitle, 16, '500', '#ffd8a8'));

      const timer = makeLabel('Ad completes in 3s…', 14, '600', '#aaa');
      root.appendChild(timer);

      let completed = false;
      const complete = makeButton('COMPLETE AD', 'ad-sim-complete');
      const skip = makeButton('Skip / No thanks', 'ad-sim-skip', false);
      root.appendChild(complete);
      root.appendChild(skip);
      document.body.appendChild(root);

      let remaining = 3;
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          timer.textContent = 'Reward ready — tap COMPLETE';
          complete.style.background = '#7dd87d';
          clearInterval(iv);
        } else {
          timer.textContent = `Ad completes in ${remaining}s…`;
        }
      };
      const iv = setInterval(tick, 1000);

      const finish = (didReward: boolean) => {
        if (completed) return;
        completed = true;
        clearInterval(iv);
        root.remove();
        resolve(didReward);
      };
      complete.addEventListener('click', () => finish(true));
      skip.addEventListener('click', () => finish(false));
    });
  },

  showInterstitial(): Promise<void> {
    return new Promise((resolve) => {
      const root = makeRoot();
      root.appendChild(makeTestBadge());
      root.appendChild(makeLabel('AD', 64, '900'));
      root.appendChild(makeLabel('A short interstitial ad would appear here', 15, '500', '#ffd8a8'));
      const cd = makeLabel('Closing in 3s…', 14, '600', '#aaa');
      root.appendChild(cd);
      const close = makeButton('CLOSE AD', 'ad-sim-close-interstitial');
      close.disabled = true;
      close.style.opacity = '0.6';
      root.appendChild(close);
      document.body.appendChild(root);

      let remaining = 3;
      const iv = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          cd.textContent = 'You can close this ad';
          close.disabled = false;
          close.style.opacity = '1';
          clearInterval(iv);
        } else {
          cd.textContent = `Closing in ${remaining}s…`;
        }
      }, 1000);

      const finish = () => { clearInterval(iv); root.remove(); resolve(); };
      close.addEventListener('click', finish);
      // Safety: auto-close after 8s if the user does nothing.
      setTimeout(finish, 8000);
    });
  },
};
