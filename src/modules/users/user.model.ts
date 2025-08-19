import type { UserRole } from '../../common/constants/roles.enum';

/**
 * User domain model stored in-memory for now.
 */
export interface UserModel {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly fullName: string;
  readonly phoneEncrypted?: string;
  readonly addressEncrypted?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Safe view of user without secrets.
 */
export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly fullName: string;
}
