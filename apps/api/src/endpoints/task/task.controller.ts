import { Task } from '@libs/common';
import { TaskService } from '@libs/services';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('tasks')
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('/:id')
  @ApiResponse({
    status: 200,
    description: 'Returns the task information',
    type: Task,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found for the given id',
  })
  @ApiParam({ name: 'id', description: 'The task identifier', required: true })
  async getTask(@Param('id') id: string): Promise<Task> {
    const task = await this.taskService.getTask(id);
    if (!task) {
      throw new NotFoundException(`Task with id '${id}' not found.`);
    }

    return task;
  }
}
