import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service:NotificationsService) {}
  @Get() list(@Req() req:any) {return this.service.list(req.user.id);}
  @Post(':id/read') read(@Req() req:any,@Param('id') id:string) {return this.service.read(id,req.user.id);}
}
