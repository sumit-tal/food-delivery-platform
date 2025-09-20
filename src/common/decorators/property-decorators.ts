/**
 * Helper functions for property decorators to work with TypeScript 5.5+
 */

import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Creates a custom property validator
 */
export function createPropertyDecorator(
  validationFunction: (value: any) => boolean,
  validationOptions?: ValidationOptions,
) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: validationOptions?.each ? `${validationFunction.name}Each` : validationFunction.name,
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: {
        validate: validationFunction,
      },
    });
  };
}
