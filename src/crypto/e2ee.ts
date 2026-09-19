/**
 * End-to-End Encryption Engine using Web Crypto API
 * ECDH P-256, HKDF-SHA256, AES-256-GCM, Safety Code derivation
 */

export interface KeyPairResult {
  keyPair: CryptoKeyPair;
  publicKeyJwk: JsonWebKey;
}

export class E2EECrypto {
  /**
   * Generates an ECDH P-256 keypair for real-time key exchange.
   */
  public static async generateIdentityKeyPair(): Promise<KeyPairResult> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    return { keyPair, publicKeyJwk };
  }

  /**
   * Exports a public key to JWK format.
   */
  public static async exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
    return await crypto.subtle.exportKey('jwk', publicKey);
  }

  /**
   * Imports a peer's JWK public key.
   */
  public static async importPeerPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );
  }

  /**
   * Derives a shared AES-256-GCM key and raw bits using HKDF-SHA256.
   */
  public static async deriveSharedKey(
    ownPrivateKey: CryptoKey,
    peerPublicKey: CryptoKey,
    saltStr: string = 'calculator-chat-salt'
  ): Promise<{ aesKey: CryptoKey; safetyCode: string }> {
    // Perform ECDH bit derivation
    const sharedBits = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: peerPublicKey
      },
      ownPrivateKey,
      256
    );

    // Import shared bits into HKDF
    const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, [
      'deriveKey',
      'deriveBits'
    ]);

    const encoder = new TextEncoder();
    const salt = encoder.encode(saltStr);
    const info = encoder.encode('calculator-chat-e2ee-v1');

    // Derive AES-GCM session key
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Derive safety code bits (6 digits)
    const safetyBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: encoder.encode('calculator-chat-safety-code-v1')
      },
      hkdfKey,
      256
    );

    const safetyArray = new Uint8Array(safetyBits);
    let num = 0;
    for (let i = 0; i < 4; i++) {
      num = (num << 8) | safetyArray[i];
    }
    const codeNum = Math.abs(num) % 1000000;
    const safetyCode = codeNum.toString().padStart(6, '0');

    return { aesKey, safetyCode };
  }

  /**
   * Encrypts plaintext string using AES-256-GCM with a random 12-byte IV.
   * Returns base64 encoded ciphertext and base64 IV.
   */
  public static async encryptMessage(
    plaintext: string,
    key: CryptoKey
  ): Promise<{ ciphertextBase64: string; ivBase64: string }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    const ciphertextBase64 = this.arrayBufferToBase64(encrypted);
    const ivBase64 = this.arrayBufferToBase64(iv.buffer);

    return { ciphertextBase64, ivBase64 };
  }

  /**
   * Decrypts base64 ciphertext and IV using AES-256-GCM.
   */
  public static async decryptMessage(
    ciphertextBase64: string,
    ivBase64: string,
    key: CryptoKey
  ): Promise<string> {
    const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
    const iv = new Uint8Array(this.base64ToArrayBuffer(ivBase64));

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  public static arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
