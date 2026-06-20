import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutating operations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const startData = {
      user: request.user,
      body: { ...request.body },
      params: { ...request.params },
      path: request.route?.path || request.url,
      ip: request.ip,
    };

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          if (!startData.user?.id) return;

          // Extract entity info from the response or path
          const entityType = this.extractEntityType(startData.path);
          const entityId = responseData?.id || parseInt(startData.params?.id) || 0;

          if (entityType) {
            await this.prisma.auditLog.create({
              data: {
                entityType,
                entityId,
                action: this.mapMethodToAction(method, startData.path),
                before: undefined,
                after: responseData || startData.body,
                userId: startData.user.id,
                ipAddress: startData.ip || null,
              },
            });
          }
        } catch (error) {
          // Audit logging should never break the main request
          console.error('Audit log error:', error);
        }
      }),
    );
  }

  private extractEntityType(path: string): string | null {
    const segments = path.split('/').filter(Boolean);
    // Path looks like: api/products/:id/confirm -> entity is "products"
    const apiIndex = segments.indexOf('api');
    if (apiIndex >= 0 && segments.length > apiIndex + 1) {
      return segments[apiIndex + 1].toUpperCase().replace(/-/g, '_');
    }
    return segments[0]?.toUpperCase() || null;
  }

  private mapMethodToAction(method: string, path: string): string {
    // Check for action endpoints like /confirm, /deliver, /cancel
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment?.startsWith(':') && !['api'].includes(lastSegment)) {
      const actions = ['confirm', 'cancel', 'deliver', 'receive', 'start', 'complete', 'adjust', 'activate', 'archive'];
      if (actions.includes(lastSegment)) {
        return lastSegment.toUpperCase();
      }
    }

    switch (method) {
      case 'POST': return 'CREATE';
      case 'PUT':
      case 'PATCH': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method;
    }
  }
}
