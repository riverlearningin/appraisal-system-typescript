import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/roles.guard';
import { ReviewsService } from './reviews.service';
import { Roles } from 'src/auth/roles.decorator';
import { ApiResponse } from 'src/common/utils/api-response';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
    constructor(private reviewsService: ReviewsService) { }

    @Post('create')
    async createReview(@Req() req, @Body() body) {
        const roles = req.user.roles;

        let reviewerRole = 'employee';

        if (roles.includes('admin')) reviewerRole = 'admin';
        else if (roles.includes('management')) reviewerRole = 'management';
        else if (roles.includes('manager')) reviewerRole = 'manager';

        const data = await this.reviewsService.createReview({
            cycleId: body.cycleId,
            employeeId: body.employeeId,
            reviewerId: req.user.userId,
            reviewerRole,
        });

        return new ApiResponse(true, data, 'Review created');
    }

    @Post('add-response')
    async addResponse(@Body() body, @Req() req) {
        const data = await this.reviewsService.addResponse({
            ...body,
            userId: req.user.userId,
        });

        return new ApiResponse(true, data, 'Response added');
    }

    @Post('add-dynamic-point')
    async addDynamicPoint(@Body() body, @Req() req) {
        const data = await this.reviewsService.addDynamicPoint({
            reviewId: body.reviewId,
            sectionId: body.sectionId,
            title: body.title,
            userId: req.user.userId,
        });

        return new ApiResponse(true, data, 'Point added');
    }

    @Post('submit/:id')
    async submit(@Param('id') id: string, @Req() req) {
        const data = await this.reviewsService.submitReview(
            Number(id),
            req.user.userId,
        );

        return new ApiResponse(true, data, 'Review submitted');
    }

    @Get('manager')
    @UseGuards(RoleGuard)
    @Roles('manager', 'management', 'admin')
    async getManagerReviews(@Req() req) {
        const data = await this.reviewsService.getReviewsForManager(
            req.user.userId,
        );

        return new ApiResponse(true, data);
    }

    @Post('generate/:cycleId')
    @UseGuards(RoleGuard)
    @Roles('management', 'admin')
    async generateReviews(@Param('cycleId') cycleId: string) {
        const data = await this.reviewsService.generateReviews(
            Number(cycleId),
        );

        return new ApiResponse(true, data);
    }

    @Get('my')
    async getMyReviews(
        @Req() req,
        @Query('page') page = '1',
        @Query('limit') limit = '10',
    ) {
        const data = await this.reviewsService.getMyReviews(
            req.user.userId,
            Number(page),
            Number(limit),
        );

        return new ApiResponse(true, data);
    }

    @UseGuards(RoleGuard)
    @Roles('management', 'admin')
    @Get('report/:employeeId')
    async getReport(@Param('employeeId') employeeId: string, @Req() req) {
        const data = await this.reviewsService.getReport(Number(employeeId), req.user.userId);
        return new ApiResponse(true, data);
    }

    @Get('report-summaries')
    async getReportSummaries(
        @Query('employeeIds') employeeIds: string,
        @Req() req,
    ) {
        const ids = (employeeIds ?? '')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);

        const data = await this.reviewsService.getReportSummaries(
            ids,
            req.user.userId,
        );

        return new ApiResponse(true, data);
    }

    @Get(':id')
    async getReviewById(
        @Param('id', ParseIntPipe) id: number,
        @Req() req,
    ) {
        const data = await this.reviewsService.getReviewById(
            id,
            req.user.userId,
        );

        return new ApiResponse(true, data);
    }
}