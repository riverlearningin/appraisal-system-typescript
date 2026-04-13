import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private prisma: PrismaService) {
        // Support both cookie-based auth and bearer-token fallback.
        // This avoids auth failures in browsers/environments that block third-party cookies.
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => req?.cookies?.access_token ?? null,
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET,
        });
    }

    async validate(payload: any) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                disabled: true,
                roles: {
                    select: {
                        role: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        if (!user || user.disabled) {
            throw new UnauthorizedException('User is disabled');
        }

        return {
            userId: user.id,
            email: user.email,
            roles: user.roles.map((r) => r.role.name),
        };
    }
}