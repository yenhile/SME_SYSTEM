import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const notificationSelect={id:true,requestId:true,title:true,message:true,createdAt:true,readAt:true};

@Injectable()
export class NotificationsService {
  constructor(private prisma:PrismaService) {}

  async list(userId:string) {
    const [items,unreadCount]=await Promise.all([
      this.prisma.internalNotification.findMany({where:{userId},select:notificationSelect,orderBy:[{createdAt:'desc'},{id:'desc'}]}),
      this.prisma.internalNotification.count({where:{userId,readAt:null}}),
    ]);
    return {items,unreadCount};
  }

  async read(id:string,userId:string) {
    // Only the owner can change a row. Preserve the first read time on retry.
    await this.prisma.internalNotification.updateMany({where:{id,userId,readAt:null},data:{readAt:new Date()}});
    const notification=await this.prisma.internalNotification.findFirst({where:{id,userId},select:notificationSelect});
    if(!notification) throw new NotFoundException('Không tìm thấy thông báo.');
    return notification;
  }
}
