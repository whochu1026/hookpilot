import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  endpointId!: string;

  @IsString()
  @MinLength(1)
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
