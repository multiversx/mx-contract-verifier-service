import { Address } from '@multiversx/sdk-core';
import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';

export class ParseScAddressPipe
  implements PipeTransform<string | undefined, Promise<string | undefined>>
{
  transform(
    value: string | undefined,
    metadata: ArgumentMetadata,
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (value === undefined || value === '') {
        return resolve(undefined);
      }

      if (Address.newFromBech32(value).isSmartContract()) {
        return resolve(value);
      }

      throw new BadRequestException(
        `Validation failed for argument '${metadata.data}' (a bech32 smart contract address is expected)`,
      );
    });
  }
}
