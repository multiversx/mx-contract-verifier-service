import { Address } from '@multiversx/sdk-core';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsScAddressConstraint implements ValidatorConstraintInterface {
  validate(address: string) {
    try {
      const addr = Address.newFromBech32(address);
      return addr.isSmartContract();
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'Invalid bech32 smart contract address';
  }
}

export function IsScAddress(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsScAddressConstraint,
    });
  };
}
