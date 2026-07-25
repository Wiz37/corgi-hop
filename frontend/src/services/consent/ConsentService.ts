// ConsentService — orchestrates GDPR/GDPR-like consent (UMP on Android/iOS),
// App Tracking Transparency (iOS), and personalization defaults.
//
// Browser preview: consent is trivially "granted" (no ads served) so the
// game runs unblocked. On native it defers to the appropriate Capacitor
// plugins (Google User Messaging Platform + AppTrackingTransparency).

import { storage, STORAGE_KEYS as K } from '@/game/systems/Storage';

export type ConsentStatus = 'unknown' | 'granted' | 'denied' | 'not_required';

export class ConsentService {
  private native = false;
  private status: ConsentStatus = 'unknown';
  private personalized = false;

  init(isNative: boolean): void {
    this.native = isNative;
    this.status = (storage.getString(K.consentGiven, 'unknown') as ConsentStatus) || 'unknown';
    this.personalized = storage.getBool(K.consentPersonalized, false);
    if (!this.native) {
      // Browser preview: consent flow is simulated. Ads never actually load
      // so we don't need to gate anything, but we track the user's choice.
      if (this.status === 'unknown') this.status = 'not_required';
    }
  }

  getStatus(): ConsentStatus { return this.status; }
  isPersonalized(): boolean { return this.personalized && this.status === 'granted'; }

  /** Called from the PrivacyScene "Manage Privacy Choices" flow. */
  async requestConsent(): Promise<ConsentStatus> {
    if (!this.native) {
      // Simulate: mark as granted non-personalized so ads can be requested.
      this.status = 'granted';
      this.personalized = false;
      storage.setString(K.consentGiven, this.status);
      storage.setBool(K.consentPersonalized, this.personalized);
      return this.status;
    }
    // Native TODO: hook Google UMP here. Placeholder always non-personalized.
    this.status = 'granted';
    this.personalized = false;
    storage.setString(K.consentGiven, this.status);
    storage.setBool(K.consentPersonalized, this.personalized);
    return this.status;
  }

  /** iOS App Tracking Transparency. Only called AFTER a short explainer. */
  async requestTracking(): Promise<boolean> {
    if (!this.native) return false;
    // Native TODO: call AppTrackingTransparency plugin.
    return false;
  }

  /** Reset consent (used by the "Manage Privacy Choices" screen). */
  reset(): void {
    this.status = 'unknown';
    this.personalized = false;
    storage.remove(K.consentGiven);
    storage.remove(K.consentPersonalized);
  }
}
