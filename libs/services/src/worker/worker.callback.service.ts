import { Task, TaskStatus } from "@libs/common";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { Constants } from "@multiversx/sdk-nestjs-common";

import { OnQueueError, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";

@Processor('verifierQueue')
export class WorkerCallbackService {
  private readonly logger: Logger;

  constructor(private readonly cachingService: CacheService) {
    this.logger = new Logger(WorkerCallbackService.name);
   }

  @Process({ name: 'callback_status' })
  public async updateStatus(taskIdentifier: string, status: TaskStatus, result?: any): Promise<void> {
    this.logger.log(`callback_status received: Updating status for task ${taskIdentifier} to ${TaskStatus[status]}`);
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

    await this.cachingService.setRemote(`task:${taskIdentifier}`, task, Constants.oneHour());
  }

  private async retrieveCachedTask(taskIdentifier: string): Promise<Task> {
    const cachedTask = await this.cachingService.getRemote<Task>(`task:${taskIdentifier}`);

    if (!cachedTask) {
      throw new Error(`Could not identify task with identifier '${taskIdentifier}'.`);
    }

    return cachedTask;
  }

  @OnQueueError()
  handleError(error: Error) {
    this.logger.error('Queue error:', error.message);
  }

  @OnQueueFailed()
  handleFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id}, from queue ${job.queue.name} , ${job.data} failed: ${error.message}.`, error.stack);
  }
}
