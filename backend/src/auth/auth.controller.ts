// src/auth/auth.controller.ts
import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    async login(
        @Body() body: { email: string; password: string },
        @Res({ passthrough: true }) res: Response,
    ) {
        const { access_token, user } = await this.authService.login(body.email, body.password);

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        });

        return { user }; // Never send the token in body
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: any) {
        return user; // Returns { userId, email, roles }
    }

    @Post('logout')
    logout(@Res({ passthrough: true }) res: Response) {
        res.clearCookie('access_token');
        return { message: 'Logged out' };
    }

    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    changePassword(
        @Body() body: { currentPassword: string; newPassword: string },
        @Req() req: any,
    ) {
        return this.authService.changePassword(
            req.user.userId,
            body.currentPassword,
            body.newPassword,
        );
    }
}