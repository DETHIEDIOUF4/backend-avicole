import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { SettingsModule } from '../settings/settings.module';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [RoomsModule, SettingsModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
