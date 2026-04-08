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

        const isProduction = process.env.NODE_ENV === 'production';
        const cookieSameSite = isProduction ? 'none' : 'lax';

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: cookieSameSite,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return { user, access_token };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: any) {
        return user; // Returns { userId, email, roles }
    }

    @Post('logout')
    logout(@Res({ passthrough: true }) res: Response) {
        const isProduction = process.env.NODE_ENV === 'production';
        // const cookieSameSite = isProduction ? 'none' : 'lax';
        const cookieSameSite = 'lax';

        res.clearCookie('access_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: cookieSameSite,
            path: '/',
        });
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