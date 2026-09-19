/**
 * Web Push VAPID Subscription Manager
 */

export class PushSubscriptionManager {
  /**
   * Registers Web Push subscription with service worker.
   */
  public static async registerPushSubscription(
    vapidPublicKey: string,
    onSubscriptionCreated: (sub: PushSubscription) => void
  ): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Push notification permission denied');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription && vapidPublicKey) {
        const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource
        });
      }

      if (subscription) {
        onSubscriptionCreated(subscription);
        return true;
      }
    } catch (e) {
      console.error('Failed to register push subscription:', e);
    }

    return false;
  }

  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
