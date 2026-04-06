import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async createUser(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const role = await this.prisma.role.findUnique({
      where: { name: 'employee' },
    });

    if (!role) {
      throw new Error('Default role not found');
    }

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },

      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async assignRole(userId: number, roleName: string) {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) throw new Error('Role not found');

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
      },
    });

    return { message: 'Role assigned successfully' };
  }

  async assignManager(employeeId: number, managerId: number) {
    if (employeeId === managerId) {
      throw new Error('Employee cannot be their own manager');
    }

    // Prevent circular hierarchy chains like A -> B -> ... -> A.
    const hierarchy = await this.prisma.userHierarchy.findMany({
      select: { employeeId: true, managerId: true },
    });

    const parentByEmployee = new Map<number, number>();
    for (const rel of hierarchy) {
      parentByEmployee.set(rel.employeeId, rel.managerId);
    }

    let current = managerId;
    const seen = new Set<number>();
    while (parentByEmployee.has(current)) {
      if (current === employeeId) {
        throw new BadRequestException('This assignment creates a circular reporting chain');
      }

      if (seen.has(current)) {
        throw new BadRequestException('Circular hierarchy detected in existing data');
      }

      seen.add(current);
      current = parentByEmployee.get(current)!;
    }

    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!manager) throw new Error('Manager not found');

    const hasManagerRole = manager.roles.some(
      (r) => r.role.name === 'manager' || r.role.name === 'management',
    );

    if (!hasManagerRole) throw new Error('Assigned manager does not have manager role');

    return this.prisma.userHierarchy.upsert({
      where: { employeeId },
      update: { managerId },
      create: { employeeId, managerId },
    });
  }

  async getMyTeam(managerId: number) {
    const relations = await this.prisma.userHierarchy.findMany({
      where: { managerId },
      include: {
        employee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return relations.map((r) => r.employee);
  }

  async getAllMyTeam(managerId: number) {
    const relations = await this.prisma.userHierarchy.findMany({
      include: {
        employee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const childrenByManager = new Map<number, Array<{ id: number; name: string; email: string }>>();
    for (const rel of relations) {
      const list = childrenByManager.get(rel.managerId) ?? [];
      list.push(rel.employee);
      childrenByManager.set(rel.managerId, list);
    }

    const queue: number[] = [managerId];
    const visitedManagers = new Set<number>();
    const seenEmployees = new Set<number>();
    const result: Array<{ id: number; name: string; email: string }> = [];

    while (queue.length > 0) {
      const currentManagerId = queue.shift()!;
      if (visitedManagers.has(currentManagerId)) {
        continue;
      }
      visitedManagers.add(currentManagerId);

      const directReports = childrenByManager.get(currentManagerId) ?? [];
      for (const employee of directReports) {
        if (!seenEmployees.has(employee.id)) {
          seenEmployees.add(employee.id);
          result.push(employee);
        }

        // Traverse only once per manager id to avoid infinite loops in bad hierarchy data.
        if (!visitedManagers.has(employee.id)) {
          queue.push(employee.id);
        }
      }
    }

    return result;
  }

  async getMyProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        roles: {
          select: { role: { select: { name: true } } },
        },
        employeeRelation: {
          take: 1,
          select: {
            manager: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.map((r) => r.role.name),
      manager: user.employeeRelation[0]?.manager ?? null,
    };
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        roles: {
          select: { role: { select: { name: true } } },
        },
        employeeRelation: {
          take: 1,
          select: {
            managerId: true,
            manager: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.map((r) => r.role.name),
      managerId: user.employeeRelation[0]?.managerId ?? null,
      managerName: user.employeeRelation[0]?.manager?.name ?? null,
    }));
  }

  async updateUser(
    userId: number,
    data: { name: string; email: string; roleNames: string[] },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('User not found');

    const requestedRoles = [...new Set(data.roleNames ?? [])];
    if (requestedRoles.length === 0) {
      throw new BadRequestException('At least one role is required');
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: requestedRoles } },
      select: { id: true, name: true },
    });

    if (roles.length !== requestedRoles.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        roles: {
          deleteMany: {},
          create: roles.map((role) => ({
            roleId: role.id,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: {
          select: {
            role: { select: { name: true } },
          },
        },
      },
    });
  }

  async deleteUser(userId: number) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      const reviews = await tx.review.findMany({
        where: {
          OR: [{ employeeId: userId }, { reviewerId: userId }],
        },
        select: { id: true },
      });

      const reviewIds = reviews.map((review) => review.id);

      if (reviewIds.length > 0) {
        await tx.reviewResponses.deleteMany({
          where: {
            reviewId: { in: reviewIds },
          },
        });

        await tx.review.deleteMany({
          where: {
            id: { in: reviewIds },
          },
        });
      }

      await tx.userHierarchy.deleteMany({
        where: {
          OR: [{ employeeId: userId }, { managerId: userId }],
        },
      });

      await tx.userRole.deleteMany({
        where: { userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { message: 'User deleted successfully' };
  }

  async getAllRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }
}