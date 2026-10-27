import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/** Every thrown error passes through here. Known HttpExceptions map to {code, message}; known Prisma errors (unique/FK/not-found) map to sensible HTTP codes as a safety net for any service that forgets to catch them explicitly; anything else is logged in full server-side and returned as a generic message — never leaking internals to the client. Matches the approved API Specification's error envelope exactly. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const correlationId = request.correlationId ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = this.codeFromStatus(status);
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? message;
        code = (r.code as string) ?? this.codeFromStatus(status);
        details = r.details ?? (Array.isArray(r.message) ? { validation: r.message } : undefined);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, code, message } = this.fromPrismaError(exception));
    } else if (exception instanceof Error) {
      this.logger.error(`[${correlationId}] ${exception.message}`, exception.stack);
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`[${correlationId}] Unhandled exception`, (exception as Error)?.stack);
    }

    response.status(status).json({
      error: { code, message, correlationId, ...(details ? { details } : {}) },
    });
  }

  /** Safety net only — services that already catch a specific Prisma code (e.g. duplicate watcher) throw their own NestJS exception first, so this only fires for the ones nobody anticipated. */
  private fromPrismaError(e: Prisma.PrismaClientKnownRequestError): { status: number; code: string; message: string } {
    switch (e.code) {
      case 'P2002':
        return { status: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'A record with these unique values already exists.' };
      case 'P2003':
        return { status: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'This action references a record that does not exist or cannot be removed while still referenced.' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'The requested record was not found.' };
      default:
        this.logger.error(`Unhandled Prisma error code ${e.code}: ${e.message}`);
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
    }
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}
