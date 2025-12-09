import {
  ErrorVerifierResponse,
  SuccessfulVerifierResponse,
  TaskStatus,
  Verifier,
  VerifierFromExisting,
} from '@libs/common';
import { Injectable, Logger } from '@nestjs/common';
import { VerifierService } from '../verifier';
import { WorkerCallbackService } from './worker.callback.service';

@Injectable()
export class WorkerService {
  private readonly logger: Logger = new Logger(WorkerService.name);

  constructor(
    private readonly verifierService: VerifierService,
    private readonly workerCallbackService: WorkerCallbackService,
  ) {}

  async workVerifier(taskId: string, validate: Verifier): Promise<void> {
    this.logger.log(`Task ${taskId} - Starting work`);

    try {
      await this.updateTask(taskId, TaskStatus.started);

      const workResult = await this.verifierService.validate(validate);

      await this.updateTask(taskId, TaskStatus.finished, workResult);
      this.logger.log(`Task ${taskId} - Work completed successfully`);
    } catch (error: any) {
      this.logger.error(`Task ${taskId} failed`);

      const errorResponse = {
        message: error.response?.message || error.message || 'An error occurred',
        error: error.response?.error || 'Error',
        statusCode: error.response?.statusCode || 500,
      };

      await this.updateTask(taskId, TaskStatus.error, errorResponse);
      this.logger.error(
        `Error in workVerifier for task ${taskId}; error: ${error.message}, stack: ${error.stack}`,
      );
    }
  }

  async workVerifierFromExisting(
    taskId: string,
    validate: VerifierFromExisting,
  ): Promise<void> {
    this.logger.log(`Task ${taskId} - Starting work`);

    try {
      await this.updateTask(taskId, TaskStatus.started);

      const workResult = await this.verifierService.validateFromExisting(validate);

      await this.updateTask(taskId, TaskStatus.finished, workResult);
      this.logger.log(`Task ${taskId} - Work completed successfully`);
    } catch (error: any) {
      this.logger.error(`Task ${taskId} failed`);

      const errorResponse = {
        message: error.response?.message || error.message || 'An error occurred',
        error: error.response?.error || 'Error',
        statusCode: error.response?.statusCode || 500,
      };

      await this.updateTask(taskId, TaskStatus.error, errorResponse);
      this.logger.error(
        `Error in workVerifierFromExisting for task ${taskId}; error: ${error.message}, stack: ${error.stack}`,
      );
    }
  }

  private async updateTask(
    taskIdentifier: string,
    status: TaskStatus,
    result?: SuccessfulVerifierResponse | ErrorVerifierResponse,
  ): Promise<void> {
    await this.workerCallbackService.updateStatus(taskIdentifier, status, result);
  }
}
