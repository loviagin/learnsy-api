import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'skills' })
export class Skill {
    @PrimaryColumn({ type: 'text' })
    id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text' })
    category: string;

    @Column({ type: 'text', nullable: true })
    icon_name?: string;
}

