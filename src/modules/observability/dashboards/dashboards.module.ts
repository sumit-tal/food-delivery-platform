import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DashboardsService } from './dashboards.service';

/**
 * DashboardsModule provides functionality for managing Grafana dashboards.
 * It includes services for provisioning and updating dashboards.
 */
@Module({
  imports: [ConfigModule],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
