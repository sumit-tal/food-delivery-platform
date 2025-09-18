import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DashboardsService provides functionality for managing Grafana dashboards.
 * It includes methods for provisioning and updating dashboards.
 */
@Injectable()
export class DashboardsService {
  private readonly dashboardsDir: string;

  public constructor(private readonly configService: ConfigService) {
    // In production, this would be configured via environment variables
    this.dashboardsDir = this.configService.get<string>(
      'GRAFANA_DASHBOARDS_DIR',
      path.join(process.cwd(), 'deploy', 'grafana', 'dashboards'),
    );
  }

  /**
   * Ensure the dashboards directory exists.
   */
  public ensureDashboardsDir(): void {
    if (!fs.existsSync(this.dashboardsDir)) {
      fs.mkdirSync(this.dashboardsDir, { recursive: true });
    }
  }

  /**
   * Get the path to the dashboards directory.
   * @returns Path to the dashboards directory
   */
  public getDashboardsDir(): string {
    return this.dashboardsDir;
  }

  /**
   * Get a list of all dashboard files.
   * @returns Array of dashboard file names
   */
  public getDashboardFiles(): string[] {
    this.ensureDashboardsDir();
    return fs
      .readdirSync(this.dashboardsDir)
      .filter((file) => file.endsWith('.json'));
  }

  /**
   * Get the content of a dashboard file.
   * @param fileName - Dashboard file name
   * @returns Dashboard content as a JSON object
   */
  public getDashboardContent(fileName: string): Record<string, unknown> {
    const filePath = path.join(this.dashboardsDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Dashboard file ${fileName} not found`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Save a dashboard to a file.
   * @param fileName - Dashboard file name
   * @param content - Dashboard content as a JSON object
   */
  public saveDashboard(
    fileName: string,
    content: Record<string, unknown>,
  ): void {
    this.ensureDashboardsDir();
    const filePath = path.join(this.dashboardsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  }
}
