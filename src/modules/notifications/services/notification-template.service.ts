import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateEntity } from '../entities/notification-template.entity';
import { NotificationData } from '../interfaces/notification.interface';

/**
 * Service for managing notification templates
 */
@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly templateRepository: Repository<NotificationTemplateEntity>,
  ) {}

  /**
   * Create a new notification template
   *
   * @param templateKey - Template key
   * @param title - Template title
   * @param content - Template content
   * @param metadata - Optional metadata
   * @returns Created template
   */
  async createTemplate(
    templateKey: string,
    title: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<NotificationTemplateEntity> {
    try {
      // Check if template already exists
      const existingTemplate = await this.templateRepository.findOne({
        where: { templateKey },
      });

      if (existingTemplate) {
        throw new Error(`Template with key ${templateKey} already exists`);
      }

      // Create new template
      const template = this.templateRepository.create({
        templateKey,
        title,
        content,
        metadata,
      });

      return this.templateRepository.save(template);
    } catch (error) {
      this.logger.error(
        `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Update an existing notification template
   *
   * @param templateKey - Template key
   * @param title - Template title
   * @param content - Template content
   * @param metadata - Optional metadata
   * @returns Updated template
   */
  async updateTemplate(
    templateKey: string,
    title: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<NotificationTemplateEntity> {
    try {
      // Find template
      const template = await this.templateRepository.findOne({
        where: { templateKey },
      });

      if (!template) {
        throw new NotFoundException(`Template with key ${templateKey} not found`);
      }

      // Update template
      template.title = title;
      template.content = content;

      if (metadata) {
        template.metadata = metadata;
      }

      return this.templateRepository.save(template);
    } catch (error) {
      this.logger.error(
        `Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get a template by key
   *
   * @param templateKey - Template key
   * @returns Template or null if not found
   */
  async getTemplate(templateKey: string): Promise<NotificationTemplateEntity | null> {
    try {
      return this.templateRepository.findOne({
        where: { templateKey },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Delete a template
   *
   * @param templateKey - Template key
   * @returns True if deleted successfully
   */
  async deleteTemplate(templateKey: string): Promise<boolean> {
    try {
      const result = await this.templateRepository.delete({ templateKey });
      return (result.affected ?? 0) > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Render a template with data
   *
   * @param templateKey - Template key
   * @param data - Data to render template with
   * @returns Notification data
   */
  async renderTemplate(
    templateKey: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<NotificationData> {
    try {
      // Get template
      const template = await this.getTemplate(templateKey);

      if (!template) {
        throw new NotFoundException(`Template with key ${templateKey} not found`);
      }

      // Render title and content
      const title = this.renderString(template.title, data);
      const content = this.renderString(template.content, data);

      return {
        userId,
        title,
        content,
        type: templateKey,
        metadata: {
          templateData: data,
          renderedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to render template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Render a string with data using template literals
   *
   * @param template - Template string
   * @param data - Data to render template with
   * @returns Rendered string
   */
  private renderString(template: string, data: Record<string, unknown>): string {
    try {
      // Replace {{variable}} with actual values
      return template.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
        const path: string = key.trim();
        const value: unknown = this.getNestedValue(data, path);
        return value !== undefined ? String(value) : match;
      });
    } catch (error) {
      this.logger.error(
        `Failed to render string: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return template;
    }
  }

  /**
   * Get a nested value from an object using dot notation
   *
   * @param obj - Object to get value from
   * @param path - Path to value using dot notation
   * @returns Value or undefined if not found
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let result: unknown = obj;

    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return undefined;
      }

      result = (result as Record<string, unknown>)[key];
    }

    return result;
  }
}
