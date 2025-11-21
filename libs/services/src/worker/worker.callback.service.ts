import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';
import { ErrorVerifierResponse, SuccessfulVerifierResponse, Task, TaskStatus } from '../../../common/src/dtos';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WorkerCallbackService {
  private readonly logger: Logger;

  constructor(private readonly cachingService: CacheService) {
    this.logger = new Logger(WorkerCallbackService.name);
  }

  public async updateStatus(
    taskIdentifier: string,
    status: TaskStatus,
    result?: SuccessfulVerifierResponse | ErrorVerifierResponse,
  ): Promise<void> {
    this.logger.log(
      `callback_status received: Updating status for task ${taskIdentifier} to ${TaskStatus[status]}`,
    );
    let task: Task;
    if (status === TaskStatus.queued) {
      task = {
        status,
        queued: new Date(),
        result,
      };
    } else {
      task = await this.retrieveCachedTask(taskIdentifier);

      switch (status) {
        case TaskStatus.started:
          task.started = new Date();
          break;
        case TaskStatus.finished:
          task.finished = new Date();
          task.result = result;
          break;
        case TaskStatus.error:
          task.finished = new Date();
          task.result = result;
          break;
      }

      task.status = status;
    }

    await this.cachingService.setRemote(
      `task:${taskIdentifier}`,
      task,
      Constants.oneHour(),
    );
  }

  private async retrieveCachedTask(taskIdentifier: string): Promise<Task> {
    const cachedTask = await this.cachingService.getRemote<Task>(
      `task:${taskIdentifier}`,
    );

    if (!cachedTask) {
      throw new Error(`Could not identify task with identifier '${taskIdentifier}'.`);
    }

    return cachedTask;
  }
}
