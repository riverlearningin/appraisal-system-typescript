import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RoleGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { ApiResponse } from 'src/common/utils/api-response';

@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Post()
    async create(@Body() body: any) {
        const data = await this.usersService.createUser(body);
        return new ApiResponse(true, data, 'User created');
    }

    @Roles('management', 'admin')
    @Post('assign-role')
    async assignRole(
        @Body() body: { userId: number; roleName: string },
        @Req() req
    ) {
        console.log(req.headers.authorization);
        const data = await this.usersService.assignRole(body.userId, body.roleName);
        return new ApiResponse(true, data, 'Role assigned');
    }

    @Roles('management', 'admin')
    @Post('assign-manager')
    async assignManager(
        @Body() body: { employeeId: number; managerId: number },
    ) {
        const data = await this.usersService.assignManager(
            body.employeeId,
            body.managerId,
        );
        return new ApiResponse(true, data, 'Manager assigned');
    }

    @Roles('manager', 'management', 'admin')
    @Get('my-team')
    async getMyTeam(@Req() req) {
        const data = await this.usersService.getMyTeam(req.user.userId);
        return new ApiResponse(true, data, 'My team retrieved');
    }

    @Roles('manager', 'management', 'admin')
    @Get('my-team-all')
    async getAllMyTeam(@Req() req) {
        const data = await this.usersService.getAllMyTeam(req.user.userId);
        return new ApiResponse(true, data, 'All my team members retrieved');
    }

    @Get('my-profile')
    async getMyProfile(@Req() req) {
        const data = await this.usersService.getMyProfile(req.user.userId);
        return new ApiResponse(true, data, 'My profile retrieved');
    }

    @Roles('management', 'admin')
    @Get('roles')
    async getAllRoles() {
        const data = await this.usersService.getAllRoles();
        return new ApiResponse(true, data);
    }

    @Roles('management', 'admin')
    @Get()
    async getAllUsers() {
        const data = await this.usersService.getAllUsers();
        return new ApiResponse(true, data);
    }

    @Roles('management', 'admin')
    @Patch(':id')
    async updateUser(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { name: string; email: string; roleNames: string[] },
    ) {
        const data = await this.usersService.updateUser(id, body);
        return new ApiResponse(true, data, 'User updated');
    }

    @Roles('management', 'admin')
    @Patch(':id/disabled')
    async setUserDisabled(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { disabled: boolean },
        @Req() req,
    ) {
        const data = await this.usersService.setUserDisabled(
            id,
            !!body.disabled,
            req.user.userId,
        );
        return new ApiResponse(true, data, body.disabled ? 'User disabled' : 'User enabled');
    }

    @Roles('management', 'admin')
    @Delete(':id')
    async deleteUser(@Param('id', ParseIntPipe) id: number) {
        const data = await this.usersService.deleteUser(id);
        return new ApiResponse(true, data, 'User deleted');
    }
}
