import { Constants } from "@multiversx/sdk-nestjs-common";

export class CacheInfo {
  key: string = "";
  ttl: number = Constants.oneSecond() * 6;

  static VerifiedContractModel(address: string): CacheInfo {
    return {
      key: `verifiedContractModel:${address}`,
      ttl: Constants.oneMinute() * 10,
    };
  }
}
