import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CyclesService {
    constructor(private prisma: PrismaService) {}

    async getAllCycles() {
        await this.prisma.cycle.updateMany({
            where: {
                status: { not: 'closed' },
                endDate: { lt: new Date() },
            },
            data: { status: 'closed' },
        });

        return this.prisma.cycle.findMany({
            orderBy: { startDate: 'desc' },
        });
    }

    async createCycle(data: {
        name: string;
        startDate: string;
        endDate: string;
    }) {
        return this.prisma.cycle.create({
            data: {
                name: data.name,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                status: 'inactive',
                showManagerResponses: true,
                showManagementResponses: true,
            },
        });
    }

    async updateCycleStatus(id: number, status: string) {
        const cycle = await this.prisma.cycle.findUnique({ where: { id } });
        if (!cycle) throw new NotFoundException('Cycle not found');

        // If activating, deactivate all other cycles first
        if (status === 'active') {
            await this.prisma.cycle.updateMany({
                where: { status: 'active' },
                data: { status: 'inactive' },
            });
        }

        return this.prisma.cycle.update({
            where: { id },
            data: {
                status,
                ...(status === 'closed' ? { endDate: new Date() } : {}),
            },
        });
    }

    async updateResponseVisibility(
        id: number,
        data: { showManagerResponses: boolean; showManagementResponses: boolean },
    ) {
        const cycle = await this.prisma.cycle.findUnique({ where: { id } });
        if (!cycle) throw new NotFoundException('Cycle not found');

        return this.prisma.cycle.update({
            where: { id },
            data: {
                showManagerResponses: Boolean(data.showManagerResponses),
                showManagementResponses: Boolean(data.showManagementResponses),
            },
        });
    }
}