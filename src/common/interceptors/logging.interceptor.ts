import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/** Structured, correlation-id-tagged request logging — one line per request, success or failure. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl, correlationId } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(JSON.stringify({ correlationId, method, url: originalUrl, ms: Date.now() - start, status: 'ok' })),
        error: (err) =>
          this.logger.warn(
            JSON.stringify({ correlationId, method, url: originalUrl, ms: Date.now() - start, status: 'error', message: err?.message }),
          ),
      }),
    );
  }
}
