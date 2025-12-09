import axios from 'axios';

import { Injectable, Logger } from '@nestjs/common';

import { CommonConfigService } from '@libs/common';
import { PinataUpload } from './entities/pinata.upload';

@Injectable()
export class PinataService {
  private readonly logger: Logger;

  constructor(private readonly configurationService: CommonConfigService) {
    this.logger = new Logger(PinataService.name);
  }

  async uploadContent(content: any): Promise<PinataUpload | undefined> {
    const url = `${this.configurationService.config.pinata.pinataUrl}/pinning/pinJSONToIPFS`;

    try {
      const response = await axios.post(
        url,
        {
          pinataContent: content,
        },
        {
          headers: {
            Authorization: `Bearer ${this.configurationService.config.pinata.pinataJwt}`,
          },
        },
      );

      return {
        hash: response.data.IpfsHash,
        url: `${this.configurationService.config.pinata.fileStorageCdnUrl}/${response.data.IpfsHash}`,
      };
    } catch (error) {
      this.logger.error('An error occurred while trying to add content to Pinata.', {
        exception: error,
      });

      throw error;
    }
  }
}
