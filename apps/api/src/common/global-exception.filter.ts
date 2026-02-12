import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { RequestWithId } from "./request-id.middleware";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();

    const requestId = req?.requestId ?? "unknown";
    const method = req?.method ?? "?";
    const path = req?.path ?? req?.url ?? "?";

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";

    let responseBody: Record<string, unknown> = { statusCode, message, requestId };

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === "object" && resp != null) {
        if ("error" in resp && typeof (resp as { error: unknown }).error === "object") {
          responseBody = { ...(resp as object), requestId } as Record<string, unknown>;
        } else if ("message" in resp) {
          const m = (resp as { message: unknown }).message;
          message = Array.isArray(m) ? (m as string[]).join(", ") : String(m);
          responseBody = { statusCode, message, requestId };
        } else {
          responseBody = { ...(resp as object), requestId } as Record<string, unknown>;
        }
      } else {
        message = String(resp);
        responseBody = { statusCode, message, requestId };
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    } else if (typeof exception === "string") {
      message = exception;
    } else {
      responseBody = { statusCode, message, requestId };
    }

    const stack = statusCode >= 500 && exception instanceof Error ? exception.stack : undefined;
    const logPayload = { requestId, method, path, statusCode, message, ...(stack ? { stack } : {}) };

    if (statusCode >= 500) this.logger.error(JSON.stringify(logPayload));
    else if (statusCode >= 400) this.logger.warn(JSON.stringify(logPayload));
    else this.logger.log(JSON.stringify(logPayload));

    if (!res.headersSent) {
      res.status(statusCode).json(responseBody);
    }
  }
}
