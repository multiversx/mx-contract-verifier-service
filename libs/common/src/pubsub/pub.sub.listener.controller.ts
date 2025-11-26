import { Controller, Logger } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { WorkerService } from "../queue-worker";

@Controller()
export class PubSubListenerController {
  private logger: Logger;

  constructor(
    private readonly workerService: WorkerService,
  ) {
    this.logger = new Logger(PubSubListenerController.name);
  }

  @EventPattern('validate')
  async validate({
    taskId,
    type,
    value,
    environment,
  }: {
    taskId: string;
    type: string;
    value: any;
    environment: "devnet" | "testnet" | "mainnet";
  }) {
    this.logger.log('Received validate event', { taskId, type, contract: value.validate.payload.contract, environment });
    await this.workerService.addVerifierJobIntoQueue(type, taskId, value);
  }

  @EventPattern('validateFromExisting')
  async validateFromExisting({
    taskId,
    type,
    value,
    environment,
  }: {
    taskId: string;
    type: string;
    value: any;
    environment: "devnet" | "testnet" | "mainnet";
  }) {
    this.logger.log(
      'Received validateFromExisting event', {
        taskId,
        type,
        contract: value.validateFromExisting.contract,
        environment }
    );
    this.logger.log('Received validateFromExisting event', { taskId, type, value, environment });
    await this.workerService.addVerifierFromExistingJobIntoQueue(type, taskId, value);
  }
}
