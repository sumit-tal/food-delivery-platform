import { SetMetadata } from '@nestjs/common';
import { Roles, ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/constants/roles.enum';

jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn(),
}));

describe('Roles Decorator - Single Role', () => {
  const setMetadataSpy = SetMetadata as jest.MockedFunction<typeof SetMetadata>;

  beforeEach(() => {
    setMetadataSpy.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When CUSTOMER role is applied, Then calls SetMetadata correctly', () => {
    const expectedRole = UserRole.CUSTOMER;
    const expectedMetadata = [expectedRole];

    Roles(expectedRole);

    expect(setMetadataSpy).toHaveBeenCalledWith(ROLES_KEY, expectedMetadata);
    expect(setMetadataSpy).toHaveBeenCalledTimes(1);
  });

  it('When ADMIN role is applied, Then calls SetMetadata correctly', () => {
    const expectedRole = UserRole.ADMIN;
    const expectedMetadata = [expectedRole];

    Roles(expectedRole);

    expect(setMetadataSpy).toHaveBeenCalledWith(ROLES_KEY, expectedMetadata);
    expect(setMetadataSpy).toHaveBeenCalledTimes(1);
  });

  it('When SUPER_ADMIN role is applied, Then calls SetMetadata correctly', () => {
    const expectedRole = UserRole.SUPER_ADMIN;
    const expectedMetadata = [expectedRole];

    Roles(expectedRole);

    expect(setMetadataSpy).toHaveBeenCalledWith(ROLES_KEY, expectedMetadata);
    expect(setMetadataSpy).toHaveBeenCalledTimes(1);
  });
});
