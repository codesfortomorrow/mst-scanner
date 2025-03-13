import { Request } from 'express';
import { LoggerService } from '../providers';

export abstract class BaseController {
  protected readonly logger: LoggerService;

  constructor(options?: { loggerDefaultMeta?: any }) {
    this.logger = new LoggerService(options?.loggerDefaultMeta);
  }

  protected getIp(req: Request): string | undefined {
    return (req.headers['x-real-ip'] as string | undefined) || req.ip;
  }
}
