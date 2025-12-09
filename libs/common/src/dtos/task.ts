import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { TaskStatus } from './task.status';
import { ErrorVerifierResponse, SuccessfulVerifierResponse } from './verifier.response';

@ApiExtraModels(SuccessfulVerifierResponse, ErrorVerifierResponse)
export class Task {
  @ApiProperty({ description: 'The status of the task.', enum: TaskStatus })
  status: TaskStatus = TaskStatus.unknown;

  @ApiProperty({
    description: 'The date and time when the task was queued.',
    type: String,
    format: 'date-time',
    required: false,
  })
  queued?: Date = new Date();

  @ApiProperty({
    description: 'The date and time when the task started.',
    type: String,
    format: 'date-time',
    required: false,
  })
  started?: Date;

  @ApiProperty({
    description: 'The date and time when the task finished.',
    type: String,
    format: 'date-time',
    required: false,
  })
  finished?: Date;

  @ApiProperty({
    description: 'The result of the task.',
    oneOf: [
      { $ref: getSchemaPath(SuccessfulVerifierResponse) },
      { $ref: getSchemaPath(ErrorVerifierResponse) },
    ],
    required: false,
  })
  result?: SuccessfulVerifierResponse | ErrorVerifierResponse;
}

export class TaskIdResponse {
  @ApiProperty({ description: 'The ID of the task.', type: String })
  taskId!: string;
}
