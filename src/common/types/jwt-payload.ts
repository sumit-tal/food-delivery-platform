/**
 * JwtPayload is the shape embedded in signed JWT access tokens.
 */
export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
}
