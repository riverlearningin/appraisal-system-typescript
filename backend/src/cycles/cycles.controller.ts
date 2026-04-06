import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CyclesService } from './cycles.service';
import { ApiResponse } from 'src/common/utils/api-response';

@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('management', 'admin')
@Controller('cycles')
export class CyclesController {
    constructor(private cyclesService: CyclesService) {}

    @Get()
    async getAllCycles() {
        const data = await this.cyclesService.getAllCycles();
        return new ApiResponse(true, data);
    }

    @Post()
    async createCycle(@Body() body: { name: string; startDate: string; endDate: string }) {
        const data = await this.cyclesService.createCycle(body);
        return new ApiResponse(true, data, 'Cycle created');
    }

    @Patch(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
    ) {
        const data = await this.cyclesService.updateCycleStatus(Number(id), body.status);
        return new ApiResponse(true, data, 'Cycle status updated');
    }

    @Patch(':id/response-visibility')
    async updateResponseVisibility(
        @Param('id') id: string,
        @Body() body: { showManagerResponses: boolean; showManagementResponses: boolean },
    ) {
        const data = await this.cyclesService.updateResponseVisibility(
            Number(id),
            body,
        );
        return new ApiResponse(true, data, 'Response visibility updated');
    }
}