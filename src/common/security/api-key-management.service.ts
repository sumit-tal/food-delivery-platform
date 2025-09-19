import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { CryptoService } from './crypto.service';

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  userId: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  rotationSchedule?: string; // Cron expression for automatic rotation
}

export interface ApiKeyCreateRequest {
  name: string;
  userId: string;
  permissions: string[];
  expiresInDays?: number;
  rotationSchedule?: string;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: ApiKey;
  error?: string;
}

/**
 * ApiKeyManagementService provides secure API key generation, validation, and rotation
 */
@Injectable()
export class ApiKeyManagementService {
  private readonly logger = new Logger(ApiKeyManagementService.name);
  private readonly apiKeys = new Map<string, ApiKey>(); // In production, use database

  public constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Generate a new API key
   */
  public async generateApiKey(request: ApiKeyCreateRequest): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const plainKey = this.generateSecureKey();
    const keyHash = this.hashApiKey(plainKey);
    
    const apiKey: ApiKey = {
      id: randomBytes(16).toString('hex'),
      name: request.name,
      keyHash,
      userId: request.userId,
      permissions: request.permissions,
      expiresAt: request.expiresInDays 
        ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
      lastUsedAt: undefined,
      isActive: true,
      createdAt: new Date(),
      rotationSchedule: request.rotationSchedule,
    };

    // Store in database (using Map for demo)
    this.apiKeys.set(apiKey.id, apiKey);

    this.logger.log(`API key generated for user ${request.userId}`, {
      keyId: apiKey.id,
      name: apiKey.name,
      permissions: apiKey.permissions,
    });

    return { apiKey, plainKey };
  }

  /**
   * Validate an API key
   */
  public async validateApiKey(plainKey: string): Promise<ApiKeyValidationResult> {
    try {
      const keyHash = this.hashApiKey(plainKey);
      
      // Find API key by hash
      const apiKey = Array.from(this.apiKeys.values()).find(key => key.keyHash === keyHash);
      
      if (!apiKey) {
        return { isValid: false, error: 'Invalid API key' };
      }

      if (!apiKey.isActive) {
        return { isValid: false, error: 'API key is inactive' };
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return { isValid: false, error: 'API key has expired' };
      }

      // Update last used timestamp
      apiKey.lastUsedAt = new Date();
      this.apiKeys.set(apiKey.id, apiKey);

      return { isValid: true, apiKey };
    } catch (error) {
      this.logger.error('API key validation failed', error);
      return { isValid: false, error: 'Validation error' };
    }
  }

  /**
   * Rotate an API key
   */
  public async rotateApiKey(keyId: string): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const existingKey = this.apiKeys.get(keyId);
    
    if (!existingKey) {
      throw new UnauthorizedException('API key not found');
    }

    // Generate new key
    const plainKey = this.generateSecureKey();
    const keyHash = this.hashApiKey(plainKey);

    // Update existing key
    const rotatedKey: ApiKey = {
      ...existingKey,
      keyHash,
      lastUsedAt: undefined,
      createdAt: new Date(),
    };

    this.apiKeys.set(keyId, rotatedKey);

    this.logger.log(`API key rotated`, {
      keyId,
      userId: rotatedKey.userId,
      name: rotatedKey.name,
    });

    return { apiKey: rotatedKey, plainKey };
  }

  /**
   * Revoke an API key
   */
  public async revokeApiKey(keyId: string): Promise<void> {
    const apiKey = this.apiKeys.get(keyId);
    
    if (!apiKey) {
      throw new UnauthorizedException('API key not found');
    }

    apiKey.isActive = false;
    this.apiKeys.set(keyId, apiKey);

    this.logger.log(`API key revoked`, {
      keyId,
      userId: apiKey.userId,
      name: apiKey.name,
    });
  }

  /**
   * List API keys for a user
   */
  public async listApiKeys(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    return Array.from(this.apiKeys.values())
      .filter(key => key.userId === userId)
      .map(key => {
        const { keyHash, ...safeKey } = key;
        return safeKey;
      });
  }

  /**
   * Get API key details (without the hash)
   */
  public async getApiKey(keyId: string): Promise<Omit<ApiKey, 'keyHash'> | null> {
    const apiKey = this.apiKeys.get(keyId);
    
    if (!apiKey) {
      return null;
    }

    const { keyHash, ...safeKey } = apiKey;
    return safeKey;
  }

  /**
   * Check if API key has permission
   */
  public hasPermission(apiKey: ApiKey, requiredPermission: string): boolean {
    return apiKey.permissions.includes(requiredPermission) || apiKey.permissions.includes('*');
  }

  /**
   * Get keys that need rotation
   */
  public async getKeysForRotation(): Promise<ApiKey[]> {
    const now = new Date();
    
    return Array.from(this.apiKeys.values()).filter(key => {
      if (!key.isActive || !key.rotationSchedule) {
        return false;
      }

      // Simple rotation logic - in production, use a proper cron parser
      // For demo, rotate keys older than 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return key.createdAt < thirtyDaysAgo;
    });
  }

  /**
   * Perform automatic key rotation
   */
  public async performAutomaticRotation(): Promise<void> {
    const keysToRotate = await this.getKeysForRotation();
    
    for (const key of keysToRotate) {
      try {
        await this.rotateApiKey(key.id);
        this.logger.log(`Automatically rotated API key`, {
          keyId: key.id,
          userId: key.userId,
          name: key.name,
        });
      } catch (error) {
        this.logger.error(`Failed to rotate API key ${key.id}`, error);
      }
    }
  }

  /**
   * Clean up expired keys
   */
  public async cleanupExpiredKeys(): Promise<void> {
    const now = new Date();
    const expiredKeys = Array.from(this.apiKeys.values()).filter(
      key => key.expiresAt && key.expiresAt < now
    );

    for (const key of expiredKeys) {
      key.isActive = false;
      this.apiKeys.set(key.id, key);
      
      this.logger.log(`Deactivated expired API key`, {
        keyId: key.id,
        userId: key.userId,
        name: key.name,
        expiredAt: key.expiresAt,
      });
    }
  }

  /**
   * Generate a secure API key
   */
  private generateSecureKey(): string {
    // Generate a secure random key with prefix
    const prefix = 'sk_';
    const randomPart = randomBytes(32).toString('base64url');
    return `${prefix}${randomPart}`;
  }

  /**
   * Hash an API key for storage
   */
  private hashApiKey(plainKey: string): string {
    return createHash('sha256').update(plainKey).digest('hex');
  }
}
