/**
 * PIN Management & Escalating Rate Limiting using Web Crypto API (PBKDF2)
 */

const PIN_PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export class PinManager {
  /**
   * Generates a random salt formatted as a hex string.
   */
  public static generateSalt(): string {
    const array = new Uint8Array(SALT_BYTES);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hashes a numeric PIN using PBKDF2-HMAC-SHA256.
   */
  public static async hashPin(pin: string, saltHex: string): Promise<string> {
    const encoder = new TextEncoder();
    const pinBuffer = encoder.encode(pin);

    const saltBuffer = new Uint8Array(
      saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pinBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PIN_PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      HASH_BYTES * 8
    );

    return Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Derives an AES-256-GCM symmetric key from PIN for local storage encryption.
   */
  public static async deriveStorageKey(pin: string, saltHex: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const pinBuffer = encoder.encode(pin);

    const saltBuffer = new Uint8Array(
      saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pinBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PIN_PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Calculates the rate limiting lock delay in milliseconds based on failed attempt count.
   * Delays: 0 attempts -> 0ms, 1 -> 1s, 2 -> 2s, 3 -> 4s, 4 -> 8s, 5+ -> 16s, capped at 60s.
   */
  public static getLockoutDelayMs(failedAttempts: number): number {
    if (failedAttempts <= 0) return 0;
    const seconds = Math.min(Math.pow(2, failedAttempts - 1), 60);
    return seconds * 1000;
  }
}
