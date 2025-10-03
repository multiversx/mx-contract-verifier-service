import axios from "axios";

import { Injectable, Logger } from "@nestjs/common";

import { AppConfigService } from '../../../../apps/api/src/config/app-config.service';
import { PinataUpload } from "./entities/pinata.upload";

@Injectable()
export class PinataService {
  private readonly logger: Logger;

  constructor(private readonly apiConfigurationService: AppConfigService) {
    this.logger = new Logger(PinataService.name);
  }

  async uploadContent(content: String): Promise<PinataUpload | undefined> {
    const url = `${this.apiConfigurationService.config.pinataUrl}/pinning/pinJSONToIPFS`;

    try {
      const response = await axios.post(url,
        {
          content,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiConfigurationService.config.pinataJwt}`,
          },
        });

      return {
        hash: response.data.IpfsHash,
        url: `${this.apiConfigurationService.config.fileStorageCdnUrl}${response.data.IpfsHash}`,
      };
    } catch (error) {
      this.logger.error(
        "An error occurred while trying to add content to Pinata.",
        {
          exception: error,
        },
      );

      throw error;
    }
  }
}
