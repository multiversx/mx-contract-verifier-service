import { Verifier } from "@libs/common";
import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bull";

@Injectable()
export class WorkerService {
  private readonly logger: Logger;

  constructor(
    @InjectQueue('verifierQueue') private verifierQueue: Queue
  ) {
    this.logger = new Logger(WorkerService.name);
  }

  async addJobIntoQueue(type: string, data: Verifier) {
    const job = await this.verifierQueue.add(type, data);
    this.logger.log({ type: 'producer', jobId: job.id, identifier: job.data.validate.payload.contract });
  }
}
