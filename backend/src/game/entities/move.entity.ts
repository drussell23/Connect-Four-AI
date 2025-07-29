import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Game } from './game.entity';

@Entity('moves')
export class Move {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, game => game.moves)
  game: Game;

  @Column()
  column: number;

  @Column()
  row: number;

  @Column()
  player: 'Red' | 'Yellow';

  @CreateDateColumn()
  createdAt: Date;
}