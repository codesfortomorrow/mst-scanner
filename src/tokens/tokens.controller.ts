import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginatedDto } from '@Common';
import { TokensService } from './tokens.service';
import { isEthereumAddress } from 'class-validator';

@ApiTags('Token')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  async getAll() {
    return await this.tokensService.getAll();
  }

  @Get(':address')
  async getInfo(@Param('address') address: string) {
    if (!isEthereumAddress(address)) {
      throw new BadRequestException('Invalid address');
    }
    return await this.tokensService.getInfo(address);
  }

  @Get(':address/holders')
  async getHoldersOf(
    @Param('address') address: string,
    @Query() query: PaginatedDto,
  ) {
    if (!isEthereumAddress(address)) {
      throw new BadRequestException('Invalid address');
    }
    return await this.tokensService.getHoldersOf(address, {
      skip: query.skip,
      take: query.take,
    });
  }
}
