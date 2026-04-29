import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';

//trying CI/CD for backend again
async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(cookieParser());

    const configuredOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean);

    app.enableCors({
        origin: (requestOrigin, callback) => {
            // Allow non-browser or same-origin requests without Origin header.
            if (!requestOrigin) {
                callback(null, true);
                return;
            }

            const normalizedOrigin = requestOrigin.replace(/\/$/, '');
            if (configuredOrigins.includes(normalizedOrigin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`CORS blocked origin: ${requestOrigin}`), false);
        },
        credentials: true, // Required for cookies to be sent cross-origin
    });

    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
