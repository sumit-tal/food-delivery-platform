import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfilesController } from 'src/modules/profiles/profiles.controller';
import { UsersService } from 'src/modules/users/users.service';
import { CryptoService } from 'src/common/security/crypto.service';
import { UpdateProfileDto } from 'src/modules/profiles/dto/update-profile.dto';
import type { UserModel } from 'src/modules/users/user.model';
import { UserRole } from 'src/common/constants/roles.enum';

type UsersServiceMock = Pick<UsersService, 'getById' | 'updateProfile'>;
type CryptoServiceMock = Pick<CryptoService, 'encrypt' | 'decrypt'>;

function createModule(
  usersService: UsersServiceMock,
  cryptoService: CryptoServiceMock,
): Promise<TestingModule> {
  return Test.createTestingModule({
    controllers: [ProfilesController],
    providers: [
      { provide: UsersService, useValue: usersService },
      { provide: CryptoService, useValue: cryptoService },
    ],
  }).compile();
}

describe('ProfilesController', () => {
  let controller: ProfilesController;
  let usersService: jest.Mocked<UsersServiceMock>;
  let cryptoService: jest.Mocked<CryptoServiceMock>;

  const mockUser: UserModel = {
    id: 'user-123',
    email: 'john.doe@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.CUSTOMER,
    fullName: 'John Doe',
    phoneEncrypted: 'encrypted-phone',
    addressEncrypted: 'encrypted-address',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockRequest = {
    user: { sub: 'user-123' },
  };

  beforeEach(async () => {
    usersService = {
      getById: jest.fn(),
      updateProfile: jest.fn(),
    };

    cryptoService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    const module: TestingModule = await createModule(usersService, cryptoService);
    controller = module.get<ProfilesController>(ProfilesController);
  });

  describe('When getMe is called', () => {
    it('Then returns user profile with decrypted sensitive fields', () => {
      // Given
      usersService.getById.mockReturnValue(mockUser);
      cryptoService.decrypt
        .mockReturnValueOnce('555-1234') // phone
        .mockReturnValueOnce('123 Main St'); // address

      // When
      const result = controller.getMe(mockRequest);

      // Then
      expect(usersService.getById).toHaveBeenCalledWith('user-123');
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-phone');
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-address');
      expect(result).toEqual({
        id: 'user-123',
        email: 'john.doe@example.com',
        role: UserRole.CUSTOMER,
        fullName: 'John Doe',
        phone: '555-1234',
        address: '123 Main St',
      });
    });

    it('Then returns user profile with undefined sensitive fields when encrypted values are null', () => {
      // Given
      const userWithoutSensitive: UserModel = {
        ...mockUser,
        phoneEncrypted: undefined,
        addressEncrypted: undefined,
      };
      usersService.getById.mockReturnValue(userWithoutSensitive);

      // When
      const result = controller.getMe(mockRequest);

      // Then
      expect(cryptoService.decrypt).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'user-123',
        email: 'john.doe@example.com',
        role: UserRole.CUSTOMER,
        fullName: 'John Doe',
        phone: undefined,
        address: undefined,
      });
    });

    it('Then throws NotFoundException when user is not found', () => {
      // Given
      usersService.getById.mockImplementation(() => {
        throw new NotFoundException('User not found');
      });

      // When & Then
      expect(() => controller.getMe(mockRequest)).toThrow(NotFoundException);
      expect(() => controller.getMe(mockRequest)).toThrow('User not found');
    });
  });

  describe('When updateMe is called', () => {
    const updateDto: UpdateProfileDto = {
      fullName: 'Jane Doe',
      phone: '555-5678',
      address: '456 Oak Ave',
    };

    it('Then updates profile and returns updated data with encrypted fields decrypted', () => {
      // Given
      const updatedUser: UserModel = {
        ...mockUser,
        fullName: 'Jane Doe',
        phoneEncrypted: 'encrypted-555-5678',
        addressEncrypted: 'encrypted-456 Oak Ave',
        updatedAt: new Date('2024-01-02'),
      };

      usersService.updateProfile.mockImplementation((id, input, encrypt) => {
        // Simulate the encrypt function being called
        if (input.phone) encrypt(input.phone);
        if (input.address) encrypt(input.address);

        return {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          fullName: input.fullName ?? updatedUser.fullName,
        };
      });
      usersService.getById.mockReturnValue(updatedUser);

      cryptoService.encrypt
        .mockReturnValueOnce('encrypted-555-5678')
        .mockReturnValueOnce('encrypted-456 Oak Ave');
      cryptoService.decrypt.mockReturnValueOnce('555-5678').mockReturnValueOnce('456 Oak Ave');

      // When
      const result = controller.updateMe(mockRequest, updateDto);

      // Then
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-123',
        updateDto,
        expect.any(Function),
      );
      expect(usersService.getById).toHaveBeenCalledWith('user-123');
      expect(cryptoService.encrypt).toHaveBeenCalledWith('555-5678');
      expect(cryptoService.encrypt).toHaveBeenCalledWith('456 Oak Ave');
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-555-5678');
      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-456 Oak Ave');

      expect(result).toEqual({
        id: 'user-123',
        email: 'john.doe@example.com',
        role: UserRole.CUSTOMER,
        fullName: 'Jane Doe',
        phone: '555-5678',
        address: '456 Oak Ave',
      });
    });

    it('Then performs partial update when only some fields are provided', () => {
      // Given
      const partialUpdateDto: UpdateProfileDto = {
        fullName: 'Jane Smith',
      };

      const partiallyUpdatedUser: UserModel = {
        ...mockUser,
        fullName: 'Jane Smith',
        updatedAt: new Date('2024-01-02'),
      };

      usersService.updateProfile.mockReturnValue({
        id: partiallyUpdatedUser.id,
        email: partiallyUpdatedUser.email,
        role: partiallyUpdatedUser.role,
        fullName: partiallyUpdatedUser.fullName,
      });
      usersService.getById.mockReturnValue(partiallyUpdatedUser);

      cryptoService.encrypt.mockImplementation((value) => `encrypted-${value}`);
      cryptoService.decrypt.mockReturnValueOnce('555-1234').mockReturnValueOnce('123 Main St');

      // When
      const result = controller.updateMe(mockRequest, partialUpdateDto);

      // Then
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-123',
        partialUpdateDto,
        expect.any(Function),
      );
      expect(result.fullName).toBe('Jane Smith');
      expect(result.phone).toBe('555-1234'); // Original decrypted value
      expect(result.address).toBe('123 Main St'); // Original decrypted value
    });

    it('Then handles undefined sensitive fields correctly', () => {
      // Given
      const updateDtoWithoutSensitive: UpdateProfileDto = {
        fullName: 'Jane Doe',
      };

      const userWithoutSensitive: UserModel = {
        ...mockUser,
        fullName: 'Jane Doe',
        phoneEncrypted: undefined,
        addressEncrypted: undefined,
      };

      usersService.updateProfile.mockReturnValue({
        id: userWithoutSensitive.id,
        email: userWithoutSensitive.email,
        role: userWithoutSensitive.role,
        fullName: userWithoutSensitive.fullName,
      });
      usersService.getById.mockReturnValue(userWithoutSensitive);

      // When
      const result = controller.updateMe(mockRequest, updateDtoWithoutSensitive);

      // Then
      expect(cryptoService.encrypt).not.toHaveBeenCalled();
      expect(cryptoService.decrypt).not.toHaveBeenCalled();
      expect(result.phone).toBeUndefined();
      expect(result.address).toBeUndefined();
    });

    it('Then throws NotFoundException when user to update is not found', () => {
      // Given
      usersService.updateProfile.mockImplementation(() => {
        throw new NotFoundException('User not found');
      });

      // When & Then
      expect(() => controller.updateMe(mockRequest, updateDto)).toThrow(NotFoundException);
      expect(() => controller.updateMe(mockRequest, updateDto)).toThrow('User not found');
    });
  });
});
