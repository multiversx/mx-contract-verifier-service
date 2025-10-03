import { TaskStatus } from "./task.status";

export class Task {
  status: TaskStatus = TaskStatus.unknown;
  queued?: Date = new Date();
  started?: Date;
  finished?: Date;
  result?: any;
}
