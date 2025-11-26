import { TaskStatus } from './task.status';
import { ErrorVerifierResponse, SuccessfulVerifierResponse } from './verifier.response';

export class Task {
  status: TaskStatus = TaskStatus.unknown;
  queued?: Date = new Date();
  started?: Date;
  finished?: Date;
  result?: SuccessfulVerifierResponse | ErrorVerifierResponse;
}
