import { ContractVerifier, Verifier, VerifierCodeHashResponse, VerifierDeletion, VerifierResponse } from '@libs/common';
import { TaskService, VerifierService } from '@libs/services';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';


@ApiTags('verifier')
@Controller('verifier')
export class VerifierController {
  constructor(
    private readonly taskService: TaskService,
    private readonly verifierService: VerifierService,
  ) {}

  @Post()
  async verify(@Body() validateBody: Verifier): Promise<VerifierResponse> {
    return await this.taskService.runVerifier(validateBody);
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

  @Get('/:address')
  @ApiResponse({
    status: 200,
    description:
      'Returns the contract verifier information for the given address',
    type: ContractVerifier,
  })
  @ApiParam({
    name: 'address',
    description: 'The dependencies depth to be returned',
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
    @Param('address') address: string,
    @Query('depth') depth: number,
    @Query('includeTestFiles') includeTestFiles: string,
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
    @Param('address') address: string,
  ): Promise<VerifierCodeHashResponse> {
    const data = await this.verifierService.getContractVerifierCodeHash(
      address,
    );

    return { codeHash: data.codeHash };
  }

  @Delete()
  async deleteVerifier(@Body() argument: VerifierDeletion): Promise<any> {
    return await this.verifierService.removeContractVerifierSource(argument);
  }
}
