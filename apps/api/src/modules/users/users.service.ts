import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { RoleName } from '@bus/types';
import { AppException, normalizePhone, paginate } from '@bus/shared';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';
import { RedisService } from '../../common/redis.service';
import { pageResult } from '../../common/dto';
import { CreateUserDto, UpdateRolePermissionsDto, UpdateUserDto, UserQuery } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly perms: Repository<Permission>,
    private readonly redis: RedisService,
  ) {}

  async list(q: UserQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.users
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .orderBy('u.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (q.role) qb.andWhere('u.id IN (SELECT ur."userId" FROM user_roles ur JOIN roles rr ON rr.id = ur."roleId" WHERE rr.name = :role)', { role: q.role });
    if (q.status) qb.andWhere('u.status = :status', { status: q.status });
    if (q.search) qb.andWhere('(u.fullName ILIKE :s OR u.phone ILIKE :s OR u.email ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items.map((u) => this.view(u)), total, page, limit);
  }

  view(u: User) {
    return {
      id: u.id,
      fullName: u.fullName,
      phone: u.phone,
      email: u.email,
      status: u.status,
      lang: u.lang,
      roles: u.roles?.map((r) => r.name) ?? [],
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }

  async get(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new AppException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
    return user;
  }

  async rolesByName(names: RoleName[]) {
    const roles = await this.roles.find({ where: { name: In(names) } });
    if (roles.length !== new Set(names).size) throw new AppException('ROLE_NOT_FOUND', HttpStatus.BAD_REQUEST);
    return roles;
  }

  async create(dto: CreateUserDto, actorRoles: string[]) {
    this.assertCanAssign(dto.roles, actorRoles);
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new AppException('INVALID_PHONE');
    if (await this.users.exist({ where: { phone } })) throw new AppException('USER_EXISTS', HttpStatus.CONFLICT);
    const user = await this.users.save(
      this.users.create({
        fullName: dto.fullName.trim(),
        phone,
        email: dto.email?.toLowerCase() ?? null,
        passwordHash: await argon2.hash(dto.password),
        roles: await this.rolesByName(dto.roles),
      }),
    );
    return this.view(user);
  }

  async update(id: string, dto: UpdateUserDto, actorRoles: string[]) {
    const user = await this.get(id);
    if (dto.roles) {
      this.assertCanAssign(dto.roles, actorRoles);
      user.roles = await this.rolesByName(dto.roles);
    }
    if (dto.fullName) user.fullName = dto.fullName.trim();
    if (dto.email !== undefined) user.email = dto.email?.toLowerCase() || null;
    if (dto.status) user.status = dto.status;
    if (dto.password) user.passwordHash = await argon2.hash(dto.password);
    await this.users.save(user);
    await this.redis.client.del(`auth:user:${id}`);
    return this.view(await this.get(id));
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    const user = await this.get(id);
    await this.users.remove(user).catch(async () => {
      user.status = 'BLOCKED' as any;
      await this.users.save(user);
    });
    await this.redis.client.del(`auth:user:${id}`);
    return { id };
  }

  private assertCanAssign(roles: RoleName[], actorRoles: string[]) {
    if (actorRoles.includes(RoleName.SUPER_ADMIN)) return;
    if (roles.includes(RoleName.SUPER_ADMIN) || roles.includes(RoleName.ADMIN))
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
  }

  listRoles() {
    return this.roles.find({ order: { name: 'ASC' } });
  }

  listPermissions() {
    return this.perms.find({ order: { code: 'ASC' } });
  }

  async updateRolePermissions(id: string, dto: UpdateRolePermissionsDto) {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new AppException('ROLE_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (role.name === RoleName.SUPER_ADMIN) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    role.permissions = dto.permissions.length ? await this.perms.find({ where: { code: In(dto.permissions) } }) : [];
    await this.roles.save(role);
    const keys = await this.redis.client.keys('auth:user:*');
    if (keys.length) await this.redis.client.del(...keys);
    return role;
  }
}
