import { Constants } from "@multiversx/sdk-nestjs-common";

export class CacheInfo {
  key: string = "";
  ttl: number = Constants.oneSecond() * 6;

  static VerifiedContractModel: CacheInfo = {
    key: "verifiedContractModel:",
    ttl: Constants.oneMinute() * 10,
  };
}
