import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * PasswordService encapsulates hashing and verification using Argon2id.
 */
@Injectable()
export class PasswordService {
  public async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  public async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
