import {
  ContractVerifier,
  ParseScAddressPipe,
  TaskIdResponse,
  Verifier,
  VerifierCodeHashResponse,
  VerifierDeletion,
  VerifierDeletionResponse,
  VerifierFromExisting,
} from '@libs/common';
import { TaskService, VerifierService } from '@libs/services';
import { ParseBoolPipe, ParseIntPipe } from '@multiversx/sdk-nestjs-common';
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('verifier')
@Controller('verifier')
export class VerifierController {
  constructor(
    private readonly taskService: TaskService,
    private readonly verifierService: VerifierService,
  ) {}

  @Post()
  @ApiResponse({
    status: 200,
    description: 'Queues a contract verification task and returns the task ID',
    type: TaskIdResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Contract to be verified does not exist',
  })
  async verify(@Body() validateBody: Verifier): Promise<TaskIdResponse> {
    return await this.taskService.runVerifier(validateBody);
  }

  @Post('/from-existing')
  @ApiResponse({
    status: 200,
    description:
      'Queues a contract verification task from an existing verified contract and returns the task ID',
    type: TaskIdResponse,
  })
  @ApiResponse({
    status: 404,
    description:
      'Could not find the contract to verify or the existing verified contract',
  })
  async verifyFromExisting(
    @Body() validateBody: VerifierFromExisting,
  ): Promise<TaskIdResponse> {
    return await this.taskService.runVerifierFromExisting(validateBody);
  }

  @Get()
  @ApiResponse({
    status: 200,
    description: 'Returns the list of verified contracts',
    type: String,
    isArray: true,
  })
  async getVerifiedContracts(): Promise<string[]> {
    return await this.verifierService.getVerifiedContracts();
  }

  @Get('/outdated')
  @ApiResponse({
    status: 200,
    description:
      'Returns the list of contracts where bytecode has changed since last verification',
    type: String,
    isArray: true,
  })
  async getOutdatedContracts(): Promise<string[]> {
    return await this.verifierService.getOutdatedContracts();
  }

  @Get('/:address')
  @ApiResponse({
    status: 200,
    description: 'Returns the contract verifier information for the given address',
    type: ContractVerifier,
  })
  @ApiResponse({
    status: 404,
    description: 'Verified contract not found for the given address',
  })
  @ApiParam({
    name: 'address',
    description: 'The bech32 address of the contract',
    required: true,
  })
  @ApiQuery({
    name: 'depth',
    description: 'The dependencies to be returned up to this depth',
    required: false,
  })
  @ApiQuery({
    name: 'includeTestFiles',
    description: 'Include test files in returned files',
    required: false,
  })
  async getVerifier(
    @Param('address', ParseScAddressPipe) address: string,
    @Query('depth', ParseIntPipe) depth: number,
    @Query('includeTestFiles', ParseBoolPipe) includeTestFiles: boolean,
  ): Promise<ContractVerifier> {
    return await this.verifierService.getContractVerifier(
      address,
      depth,
      includeTestFiles,
    );
  }

  @Get('/:address/codehash')
  @ApiResponse({
    status: 200,
    description: 'Contract verification code hash in hex format',
    type: VerifierCodeHashResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Contract verification code hash not found',
  })
  @ApiParam({
    name: 'address',
    description: 'The address of the contract',
    required: true,
  })
  async getContractCodeHash(
    @Param('address', ParseScAddressPipe) address: string,
  ): Promise<VerifierCodeHashResponse> {
    return await this.verifierService.getContractVerifierCodeHash(address);
  }

  @Delete()
  @ApiResponse({
    status: 200,
    description: 'Verified contract successfully deleted',
    type: VerifierDeletionResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Could not determine the owner of the contract',
  })
  @ApiResponse({
    status: 404,
    description: 'Verified contract not found for the given address',
  })
  async deleteVerifier(
    @Body() argument: VerifierDeletion,
  ): Promise<VerifierDeletionResponse> {
    const response = await this.verifierService.removeContractVerifierSource(argument);
    return new VerifierDeletionResponse({
      message: `Verified contract for address ${response.address} successfully deleted.`,
    });
  }
}
