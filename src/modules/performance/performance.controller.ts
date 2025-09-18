import { Controller, Get, Post, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerformanceService } from './performance.service';
import { IndexOptimizationService } from '../../common/services/index-optimization.service';
import { UserRole } from '../../common/constants/roles.enum';

/**
 * Controller for performance monitoring and optimization endpoints
 */
@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceController {
  private readonly logger = new Logger(PerformanceController.name);

  constructor(
    private readonly performanceService: PerformanceService,
    private readonly indexOptimizationService: IndexOptimizationService,
  ) {}

  /**
   * Get system health metrics
   * @returns System health metrics
   */
  @Get('health')
  @Roles(UserRole.ADMIN)
  async getSystemHealthMetrics(): Promise<Record<string, unknown>> {
    this.logger.log('Getting system health metrics');
    return this.performanceService.getSystemHealthMetrics();
  }

  /**
   * Analyze database indexes
   * @returns Analysis results
   */
  @Post('analyze-indexes')
  @Roles(UserRole.ADMIN)
  async analyzeIndexes(): Promise<{ message: string }> {
    this.logger.log('Analyzing database indexes');
    await this.indexOptimizationService.analyzeIndexUsage();
    return { message: 'Index analysis completed successfully' };
  }
}
