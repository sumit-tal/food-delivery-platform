import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * CryptoService provides AES-256-GCM encryption/decryption for sensitive fields.
 * ENCRYPTION_KEY must be a base64-encoded 32-byte key.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  public constructor(private readonly configService: ConfigService) {
    const base64Key: string = this.configService.get<string>('ENCRYPTION_KEY', '');
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Returns base64 string formatted as iv:ciphertext:authTag.
   */
  public encrypt(plaintext: string): string {
    const iv: Buffer = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext: Buffer = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag: Buffer = cipher.getAuthTag();
    return Buffer.from(iv).toString('base64') + ':' + ciphertext.toString('base64') + ':' + authTag.toString('base64');
  }

  /**
   * Decrypts value produced by encrypt().
   */
  public decrypt(payload: string): string {
    const [ivB64, ctB64, tagB64] = payload.split(':');
    const iv: Buffer = Buffer.from(ivB64, 'base64');
    const ciphertext: Buffer = Buffer.from(ctB64, 'base64');
    const authTag: Buffer = Buffer.from(tagB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext: Buffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
