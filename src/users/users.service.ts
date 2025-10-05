import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeepPartial } from 'typeorm';
import { AppUser } from './app-user.entity';

@Injectable()
export class UsersService {
    constructor(@InjectRepository(AppUser) private repo: Repository<AppUser>) { }

    async ensureBySub(params: {
        sub: string;
        email?: string | null;
        name?: string | null;
        avatarUrl?: string | null;
    }): Promise<AppUser> {
        const { sub, email, name, avatarUrl } = params;
        const existing = await this.repo.findOne({ where: { auth_user_id: sub } });
        if (existing) {
            existing.last_login_at = new Date();
            if (existing.name == null && name) existing.name = name;
            if (existing.email_snapshot == null && email) existing.email_snapshot = email;
            if (existing.avatar_url == null && avatarUrl) existing.avatar_url = avatarUrl;
            existing.updated_at = new Date();
            return this.repo.save(existing);
        }
        const created = this.repo.create({
            auth_user_id: sub,
            name: name ?? null,
            email_snapshot: email ?? null,
            avatar_url: avatarUrl ?? null,
            last_login_at: new Date(),
        } as DeepPartial<AppUser>);

        return this.repo.save(created);
    }

    async getMeBySub(sub: string) {
        return this.repo.findOne({ where: { auth_user_id: sub } });
    }

    async updateMe(sub: string, patch: Partial<Pick<AppUser, 'name' | 'avatar_url'>>) {
        await this.repo.update({ auth_user_id: sub }, { ...patch, updated_at: new Date() });
        return this.getMeBySub(sub);
    }

    async existsBySub(sub: string): Promise<boolean> {
        const cnt = await this.repo.count({ where: { auth_user_id: sub } });
        return cnt > 0;
    }

    async bootstrap(params: {
        sub: string;
        email?: string | null;
        name?: string | null;
        avatarUrl?: string | null;
    }): Promise<AppUser> {
        const { sub, email, name, avatarUrl } = params;
        const existing = await this.repo.findOne({ where: { auth_user_id: sub } });
        if (existing) return existing;

        const created = this.repo.create({
            auth_user_id: sub,
            name: name ?? null,
            email_snapshot: email ?? null,
            avatar_url: avatarUrl ?? null,
            last_login_at: new Date(),
        } as DeepPartial<AppUser>);
        return this.repo.save(created);
    }
}