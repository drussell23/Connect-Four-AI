import { Module } from '@nestjs/common';
import { MlClientService } from './ml-client.service';

@Module({
  providers: [MlClientService],
  exports: [MlClientService],
})
export class MlModule {}