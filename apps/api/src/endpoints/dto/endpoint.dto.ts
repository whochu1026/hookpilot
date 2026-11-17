import { IsBoolean, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateEndpointDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUrl({ require_tld: false })
  url!: string;
}

export class UpdateEndpointDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
