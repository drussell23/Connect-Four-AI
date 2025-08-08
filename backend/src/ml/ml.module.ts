import { Module } from '@nestjs/common';
import { MlClientService } from './ml-client.service';
import { OptimizedMlClientService } from './ml-client-optimized.service';

@Module({
  providers: [MlClientService, OptimizedMlClientService],
  exports: [MlClientService, OptimizedMlClientService],
})
export class MlModule {}