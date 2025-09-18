#!/usr/bin/env ts-node
/**
 * Script to analyze and optimize database indexes
 * 
 * Usage:
 * npm run optimize-indexes
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { IndexOptimizationService } from '../src/common/services/index-optimization.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('OptimizeIndexes');
  logger.log('Starting database index optimization...');
  
  try {
    // Create a standalone application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get the index optimization service
    const indexOptimizationService = app.get(IndexOptimizationService);
    
    // Analyze indexes
    logger.log('Analyzing indexes...');
    await indexOptimizationService.analyzeIndexUsage();
    
    // Add recommended indexes (in a production environment, this would be done after manual review)
    // This is just an example of how to create indexes programmatically
    logger.log('Adding recommended indexes...');
    
    // Example: Create index on orders.created_at for better date range queries
    await indexOptimizationService.createIndex('orders', 'created_at');
    
    // Example: Create index on order_items.order_id for faster joins
    await indexOptimizationService.createIndex('order_items', 'order_id');
    
    // Example: Create index on restaurants.location for geospatial queries
    await indexOptimizationService.createIndex('restaurants', 'location');
    
    // Example: Create composite index for common filter combinations
    await indexOptimizationService.createIndex('restaurants', 'city, cuisine_type', 'idx_restaurants_city_cuisine');
    
    // Example: Create index for full-text search
    await indexOptimizationService.createIndex('restaurants', 'name', 'idx_restaurants_name_fts');
    
    logger.log('Index optimization completed successfully');
    
    // Close the application context
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Error during index optimization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

bootstrap();
