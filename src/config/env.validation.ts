import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

enum NodeEnv {
  development = 'development',
  test = 'test',
  production = 'production',
}

class EnvironmentVariables {
  @IsIn(Object.values(NodeEnv))
  @IsOptional()
  NODE_ENV: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  // Neither pair is required at the validation stage — configuration.ts's
  // resolveKey() enforces the real rule (BASE64 required in production, PATH
  // acceptable only in development) with a much clearer, key-specific error
  // than a generic decorator could give.
  @IsString()
  @IsOptional()
  JWT_ACCESS_PRIVATE_KEY_PATH: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_PUBLIC_KEY_PATH: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_PRIVATE_KEY_BASE64: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_PUBLIC_KEY_BASE64: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsInt()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN_DAYS: number;
}

/** Fails fast at boot with a readable message instead of surfacing a confusing error later at first use. */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }
  return validated;
}
