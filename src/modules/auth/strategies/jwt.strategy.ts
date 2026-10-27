import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessPublicKey'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Deliberately does not re-hit the database — the short access-token TTL bounds
    // how stale roleId/mustChangePassword can ever get, per the approved Auth Flow.
    return {
      userId: payload.sub,
      roleId: payload.roleId,
      isSystemOwner: payload.isSystemOwner,
      mustChangePassword: payload.mustChangePassword,
    };
  }
}
