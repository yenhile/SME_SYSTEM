import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.QUAN_LY, RoleCode.CBTD, RoleCode.THAM_QUYEN)
  findAll(@Query('role') role?: RoleCode) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @Roles(RoleCode.ADMIN, RoleCode.QUAN_LY)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(RoleCode.ADMIN)
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Put(':id')
  @Roles(RoleCode.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }
}
