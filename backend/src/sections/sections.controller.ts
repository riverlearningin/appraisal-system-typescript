import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { SectionsService } from './sections.service';
import { ApiResponse } from 'src/common/utils/api-response';

@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('management', 'admin')
@Controller('sections')
export class SectionsController {
    constructor(private sectionsService: SectionsService) {}

    @Get()
    async getAllSections() {
        const data = await this.sectionsService.getAllSections();
        return new ApiResponse(true, data);
    }

    @Post()
    async createSection(@Body() body: { name: string; isDynamic: boolean }) {
        const data = await this.sectionsService.createSection(body);
        return new ApiResponse(true, data, 'Section created');
    }

    @Post(':id/points')
    async addPoint(
        @Param('id') id: string,
        @Body() body: { title: string },
    ) {
        const data = await this.sectionsService.addPoint(Number(id), body);
        return new ApiResponse(true, data, 'Point added');
    }
}