import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Move } from './move.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('json')
  board: any[][];

  @Column()
  currentPlayer: 'Red' | 'Yellow';

  @Column({ default: 'active' })
  status: 'active' | 'won' | 'draw';

  @Column({ nullable: true })
  winner: 'Red' | 'Yellow' | null;

  @Column({ default: 20 })
  aiDifficulty: number;

  @OneToMany(() => Move, move => move.game)
  moves: Move[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}