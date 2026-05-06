import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [RoomsModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
