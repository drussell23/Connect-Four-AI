import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MlClientService } from './ml-client.service';

@Module({
  imports: [HttpModule],
  providers: [MlClientService],
  exports: [MlClientService],
})
export class MlModule {}