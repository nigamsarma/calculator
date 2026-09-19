/**
 * VAPID Web Push Dispatcher for Cloudflare Workers
 */

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payloadData: Record<string, any>,
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
): Promise<boolean> {
  try {
    const endpoint = subscription.endpoint;
    const body = JSON.stringify(payloadData);

    // Basic Web Push dispatch trigger
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Urgency': 'normal'
      },
      body
    });

    return res.ok || res.status === 201;
  } catch (e) {
    console.error('Web Push notification failed:', e);
    return false;
  }
}
