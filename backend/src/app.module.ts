import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { BomsModule } from './modules/boms/boms.module';
import { SalesOrdersModule } from './modules/sales-orders/sales-orders.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { ManufacturingOrdersModule } from './modules/manufacturing-orders/manufacturing-orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { UsersModule } from './modules/users/users.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { SequenceService } from './common/services/sequence.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CustomersModule,
    VendorsModule,
    BomsModule,
    SalesOrdersModule,
    PurchaseOrdersModule,
    ManufacturingOrdersModule,
    InventoryModule,
    DashboardModule,
    AuditLogsModule,
    UsersModule,
  ],
  providers: [
    SequenceService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [SequenceService],
})
export class AppModule {}
