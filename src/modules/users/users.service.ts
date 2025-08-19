import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { UserRole } from '../../common/constants/roles.enum';
import type { UserModel, PublicUser } from './user.model';
import { PasswordService } from '../../common/security/password.service';

/**
 * CreateUserInput represents the required data to create a user.
 */
export interface CreateUserInput {
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
  readonly fullName: string;
  readonly phone?: string;
  readonly address?: string;
}

/**
 * UpdateProfileInput captures optional profile attributes to update.
 */
export interface UpdateProfileInput {
  readonly fullName?: string;
  readonly phone?: string;
  readonly address?: string;
}

/**
 * UsersService manages users in an in-memory store for now.
 */
@Injectable()
export class UsersService {
  private readonly users: Map<string, UserModel> = new Map<string, UserModel>();

  public constructor(private readonly passwordService: PasswordService) {}

  /**
   * Creates a new user if the email is unregistered.
   */
  public async create(data: CreateUserInput, encrypt: (v: string) => string): Promise<PublicUser> {
    this.ensureEmailAvailable(data.email);
    const id: string = uuidv4();
    const passwordHash: string = await this.passwordService.hash(data.password);
    const user: UserModel = this.buildUserModel(id, data, passwordHash, encrypt);
    this.users.set(id, user);
    return this.toPublic(user);
  }

  /**
   * Validates credentials and returns the user if valid.
   */
  public async validateCredentials(email: string, password: string): Promise<UserModel | null> {
    const user: UserModel | undefined = this.findByEmailInternal(email);
    if (!user) {
      return null;
    }
    const ok: boolean = await this.passwordService.verify(user.passwordHash, password);
    return ok ? user : null;
  }

  /**
   * Returns a user by id or throws if missing.
   */
  public getById(id: string): UserModel {
    const user: UserModel | undefined = this.users.get(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Returns public projection of user by id.
   */
  public getPublicById(id: string): PublicUser {
    return this.toPublic(this.getById(id));
  }

  /**
   * Updates selected profile fields.
   */
  public updateProfile(id: string, input: UpdateProfileInput, encrypt: (v: string) => string): PublicUser {
    const user: UserModel = this.getById(id);
    const updated: UserModel = {
      ...user,
      fullName: input.fullName ?? user.fullName,
      phoneEncrypted: input.phone ? encrypt(input.phone) : user.phoneEncrypted,
      addressEncrypted: input.address ? encrypt(input.address) : user.addressEncrypted,
      updatedAt: new Date()
    };
    this.users.set(id, updated);
    return this.toPublic(updated);
  }

  private findByEmailInternal(email: string): UserModel | undefined {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return undefined;
  }

  /**
   * Finds a user by email if present.
   */
  public findByEmail(email: string): UserModel | undefined {
    return this.findByEmailInternal(email);
  }

  private toPublic(user: UserModel): PublicUser {
    return { id: user.id, email: user.email, role: user.role, fullName: user.fullName };
  }

  private ensureEmailAvailable(email: string): void {
    if (this.findByEmailInternal(email)) {
      throw new ConflictException('Email already registered');
    }
  }

  private buildUserModel(
    id: string,
    data: CreateUserInput,
    passwordHash: string,
    encrypt: (v: string) => string
  ): UserModel {
    const now: Date = new Date();
    return {
      id,
      email: data.email,
      passwordHash,
      role: data.role,
      fullName: data.fullName,
      phoneEncrypted: data.phone ? encrypt(data.phone) : undefined,
      addressEncrypted: data.address ? encrypt(data.address) : undefined,
      createdAt: now,
      updatedAt: now
    };
  }
}
