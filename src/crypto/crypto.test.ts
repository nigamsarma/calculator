import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PinManager } from './pin.ts';
import { E2EECrypto } from './e2ee.ts';

describe('PinManager', () => {
  it('hashes PIN deterministically with given salt', async () => {
    const salt = PinManager.generateSalt();
    const hash1 = await PinManager.hashPin('123456', salt);
    const hash2 = await PinManager.hashPin('123456', salt);
    const hashDifferent = await PinManager.hashPin('654321', salt);

    assert.strictEqual(hash1, hash2);
    assert.notStrictEqual(hash1, hashDifferent);
  });

  it('calculates escalating lockout delays', () => {
    assert.strictEqual(PinManager.getLockoutDelayMs(0), 0);
    assert.strictEqual(PinManager.getLockoutDelayMs(1), 1000);
    assert.strictEqual(PinManager.getLockoutDelayMs(2), 2000);
    assert.strictEqual(PinManager.getLockoutDelayMs(3), 4000);
    assert.strictEqual(PinManager.getLockoutDelayMs(4), 8000);
    assert.strictEqual(PinManager.getLockoutDelayMs(5), 16000);
  });
});

describe('E2EECrypto', () => {
  it('generates keypairs and derives matching shared keys and safety codes between User A and User B', async () => {
    const userA = await E2EECrypto.generateIdentityKeyPair();
    const userB = await E2EECrypto.generateIdentityKeyPair();

    const peerA = await E2EECrypto.importPeerPublicKey(userB.publicKeyJwk);
    const peerB = await E2EECrypto.importPeerPublicKey(userA.publicKeyJwk);

    const derivedA = await E2EECrypto.deriveSharedKey(userA.keyPair.privateKey, peerA);
    const derivedB = await E2EECrypto.deriveSharedKey(userB.keyPair.privateKey, peerB);

    assert.strictEqual(derivedA.safetyCode, derivedB.safetyCode);
    assert.strictEqual(derivedA.safetyCode.length, 6);

    // Test encryption / decryption between A and B
    const message = 'Hello, this is a top secret message!';
    const encrypted = await E2EECrypto.encryptMessage(message, derivedA.aesKey);
    const decrypted = await E2EECrypto.decryptMessage(
      encrypted.ciphertextBase64,
      encrypted.ivBase64,
      derivedB.aesKey
    );

    assert.strictEqual(decrypted, message);
  });
});
