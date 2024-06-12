import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { RoleName, UserStatus } from '@bus/types';
import { AppException, normalizePhone } from '@bus/shared';
import { envInt } from '@bus/config';
import { User } from '../users/user.entity';
import { Role } from '../users/role.entity';
import { Driver } from '../drivers/driver.entity';
import { RedisService } from '../../common/redis.service';
import { AuthUser } from '../../common/decorators';
import { OtpService } from './otp.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto, VerifyOtpDto } from './auth.dto';

const REFRESH_TTL = () => envInt('JWT_REFRESH_TTL_DAYS', 30) * 86400;
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly otp: OtpService,
  ) {}

  phoneOrFail(raw: string) {
    const phone = normalizePhone(raw);
    if (!phone) throw new AppException('INVALID_PHONE');
    return phone;
  }

  async login(dto: LoginDto) {
    const login = dto.login.trim().toLowerCase();
    const phone = normalizePhone(login);
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('r.permissions', 'p')
      .where(phone ? 'u.phone = :phone' : 'LOWER(u.email) = :login', { phone, login })
      .getOne();
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password)))
      throw new AppException('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
    return this.issue(user);
  }

  async loginWithOtp(dto: VerifyOtpDto, correlationId?: string) {
    const phone = this.phoneOrFail(dto.phone);
    await this.otp.verify(phone, dto.code, correlationId);
    let user = await this.users.findOne({ where: { phone } });
    let created = false;
    if (!user) {
      user = await this.createPassenger(phone, dto.fullName?.trim() || `+${phone}`);
      created = true;
    }
    return { ...(await this.issue(user)), created };
  }

  async register(dto: RegisterDto, correlationId?: string) {
    const phone = this.phoneOrFail(dto.phone);
    if (await this.users.exist({ where: { phone } })) throw new AppException('USER_EXISTS', HttpStatus.CONFLICT);
    await this.otp.verify(phone, dto.code, correlationId);
    const user = await this.createPassenger(phone, dto.fullName.trim(), dto.password, dto.email);
    return this.issue(user);
  }

  async createPassenger(phone: string, fullName: string, password?: string, email?: string) {
    const role = await this.roles.findOneByOrFail({ name: RoleName.PASSENGER });
    const user = this.users.create({
      phone,
      fullName,
      email: email?.toLowerCase() ?? null,
      passwordHash: password ? await argon2.hash(password) : null,
      roles: [role],
    });
    return this.users.save(user);
  }

  async issue(user: User) {
    if (user.status !== UserStatus.ACTIVE) throw new AppException('USER_BLOCKED', HttpStatus.FORBIDDEN);
    await this.users.update(user.id, { lastLoginAt: new Date() });
    const roles = user.roles.map((r) => r.name);
    const accessToken = await this.jwt.signAsync({ sub: user.id, roles });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.redis.client.set(`refresh:${hashToken(refreshToken)}`, user.id, 'EX', REFRESH_TTL());
    await this.redis.client.del(`auth:user:${user.id}`);
    return { accessToken, refreshToken, user: await this.profile(user.id) };
  }

  async refresh(token: string) {
    const key = `refresh:${hashToken(token)}`;
    const userId = await this.redis.client.getdel(key);
    if (!userId) throw new AppException('INVALID_REFRESH_TOKEN', HttpStatus.UNAUTHORIZED);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new AppException('INVALID_REFRESH_TOKEN', HttpStatus.UNAUTHORIZED);
    return this.issue(user);
  }

  async logout(token?: string) {
    if (token) await this.redis.client.del(`refresh:${hashToken(token)}`);
    return { ok: true };
  }

  async authUser(id: string): Promise<AuthUser | null> {
    const key = `auth:user:${id}`;
    const cached = await this.redis.getJson<AuthUser>(key);
    if (cached) return cached;
    const user = await this.users.findOne({ where: { id } });
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    const driver = await this.drivers.findOne({ where: { userId: id }, select: ['id'] });
    const auth: AuthUser = {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      lang: user.lang,
      roles: user.roles.map((r) => r.name),
      permissions: [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code)))],
      driverId: driver?.id ?? null,
    };
    await this.redis.setJson(key, auth, 60);
    return auth;
  }

  async profile(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new AppException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
    const driver = await this.drivers.findOne({ where: { userId: id } });
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      lang: user.lang,
      status: user.status,
      roles: user.roles.map((r) => r.name),
      permissions: [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code)))],
      driverId: driver?.id ?? null,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.users.update(id, {
      ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.toLowerCase() || null } : {}),
      ...(dto.lang ? { lang: dto.lang } : {}),
    });
    await this.redis.client.del(`auth:user:${id}`);
    return this.profile(id);
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOneOrFail();
    if (user.passwordHash) {
      if (!dto.currentPassword || !(await argon2.verify(user.passwordHash, dto.currentPassword)))
        throw new AppException('INVALID_CREDENTIALS', HttpStatus.BAD_REQUEST);
    }
    await this.users.update(id, { passwordHash: await argon2.hash(dto.newPassword) });
    return { ok: true };
  }
}
