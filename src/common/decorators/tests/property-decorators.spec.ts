import { createPropertyDecorator } from '../property-decorators';
import { registerDecorator } from 'class-validator';

jest.mock('class-validator', () => ({
  registerDecorator: jest.fn(),
}));

describe('createPropertyDecorator', () => {
  let mockRegisterDecorator: jest.MockedFunction<typeof registerDecorator>;

  beforeEach(() => {
    mockRegisterDecorator = registerDecorator as jest.MockedFunction<typeof registerDecorator>;
    jest.clearAllMocks();
  });

  describe('Basic decorator creation', () => {
    it('When creating basic decorator, Then registers with correct parameters', () => {
      const validationFunction = jest.fn().mockReturnValue(true);
      const target = {};
      const propertyName = 'testProperty';

      const decorator = createPropertyDecorator(validationFunction);
      decorator(target, propertyName);

      expect(mockRegisterDecorator).toHaveBeenCalledTimes(1);
      expect(mockRegisterDecorator).toHaveBeenCalledWith({
        name: validationFunction.name,
        target: target.constructor,
        propertyName,
        options: undefined,
        constraints: [],
        validator: {
          validate: validationFunction,
        },
      });
    });

    it('When validation function has custom name, Then uses function name', () => {
      function customValidator(): boolean {
        return true;
      }
      const target = {};
      const propertyName = 'testProperty';

      const decorator = createPropertyDecorator(customValidator);
      decorator(target, propertyName);

      expect(mockRegisterDecorator).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'customValidator',
        }),
      );
    });
  });

  describe('Validation options handling', () => {
    it('When validation options provided, Then passes options to registerDecorator', () => {
      const validationFunction = jest.fn().mockReturnValue(true);
      const validationOptions = { message: 'Custom error message' };
      const target = {};
      const propertyName = 'testProperty';

      const decorator = createPropertyDecorator(validationFunction, validationOptions);
      decorator(target, propertyName);

      expect(mockRegisterDecorator).toHaveBeenCalledWith(
        expect.objectContaining({
          options: validationOptions,
        }),
      );
    });

    it('When each option is true, Then appends Each to decorator name', () => {
      const validationFunction = jest.fn().mockReturnValue(true);
      const validationOptions = { each: true };
      const target = {};
      const propertyName = 'testProperty';

      const decorator = createPropertyDecorator(validationFunction, validationOptions);
      decorator(target, propertyName);

      expect(mockRegisterDecorator).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `${validationFunction.name}Each`,
        }),
      );
    });

    it('When multiple validation options provided, Then passes all options', () => {
      const validationFunction = jest.fn().mockReturnValue(true);
      const validationOptions = {
        message: 'Error message',
        each: true,
        groups: ['group1', 'group2'],
      };
      const target = {};
      const propertyName = 'testProperty';

      const decorator = createPropertyDecorator(validationFunction, validationOptions);
      decorator(target, propertyName);

      expect(mockRegisterDecorator).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `${validationFunction.name}Each`,
          options: validationOptions,
        }),
      );
    });
  });

  describe('Target handling', () => {
    it('When applied to different targets, Then uses correct constructor', () => {
      const validationFunction = jest.fn().mockReturnValue(true);
      class TestClass1 {}
      class TestClass2 {}
      const instance1 = new TestClass1();
      const instance2 = new TestClass2();
      const propertyName = 'testProperty';

      const decorator = createPropertyDecorator(validationFunction);
      decorator(instance1, propertyName);
      decorator(instance2, propertyName);

      expect(mockRegisterDecorator).toHaveBeenCalledTimes(2);
      expect(mockRegisterDecorator).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          target: TestClass1,
        }),
      );
      expect(mockRegisterDecorator).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          target: TestClass2,
        }),
      );
    });
  });

  describe('Multiple decorators', () => {
    it('When creating multiple decorators, Then each is independent', () => {
      const validationFunction = jest.fn().mockReturnValue(true);
      const target1 = {};
      const target2 = {};
      const propertyName1 = 'property1';
      const propertyName2 = 'property2';

      const decorator1 = createPropertyDecorator(validationFunction);
      const decorator2 = createPropertyDecorator(validationFunction);
      decorator1(target1, propertyName1);
      decorator2(target2, propertyName2);

      expect(mockRegisterDecorator).toHaveBeenCalledTimes(2);
      expect(mockRegisterDecorator).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          propertyName: propertyName1,
        }),
      );
      expect(mockRegisterDecorator).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          propertyName: propertyName2,
        }),
      );
    });
  });

  describe('Validation function behavior', () => {
    it('When validation function returns different values, Then decorator works regardless', () => {
      const validationFunctionPass = jest.fn().mockReturnValue(true);
      const validationFunctionFail = jest.fn().mockReturnValue(false);
      const target = {};
      const propertyName = 'testProperty';

      const decoratorPass = createPropertyDecorator(validationFunctionPass);
      const decoratorFail = createPropertyDecorator(validationFunctionFail);
      decoratorPass(target, propertyName);
      decoratorFail(target, `${propertyName}Fail`);

      expect(mockRegisterDecorator).toHaveBeenCalledTimes(2);
      expect(validationFunctionPass).not.toHaveBeenCalled();
      expect(validationFunctionFail).not.toHaveBeenCalled();
    });
  });
});
