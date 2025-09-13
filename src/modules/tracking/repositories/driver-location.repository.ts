import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../services/database.service';
import { LocationUpdateDto } from '../dto/location-update.dto';
import { DbLocation, NearbyDriver } from '../interfaces';
import { IDriverLocationRepository } from './driver-location.repository.interface';

/**
 * Repository for driver location data operations
 */
@Injectable()
export class DriverLocationRepository implements IDriverLocationRepository {
  private readonly logger = new Logger(DriverLocationRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Save a batch of driver location updates
   */
  async saveBatchLocations(locationUpdates: LocationUpdateDto[]): Promise<void> {
    if (locationUpdates.length === 0) {
      return;
    }

    try {
      // Use a transaction for batch inserts
      await this.databaseService.executeTransaction(async (client) => {
        // Prepare values for bulk insert
        const values = locationUpdates.map((update, index) => {
          const params = [
            update.driverId,
            update.latitude,
            update.longitude,
            update.heading || null,
            update.speed || null,
            update.accuracy || null,
            update.batteryLevel || null,
          ];
          
          // Create placeholders for the prepared statement
          const placeholders = params.map((_, i) => `$${i + 1 + (index * 7)}`).join(', ');
          return `(${placeholders})`;
        }).join(', ');

        // Flatten all parameters
        const flatParams = locationUpdates.flatMap(update => [
          update.driverId,
          update.longitude,
          update.latitude,
          update.heading || null,
          update.speed || null,
          update.accuracy || null,
          update.batteryLevel || null,
          new Date()
        ]);

        // Execute the function for each location update
        const query = `
          INSERT INTO driver_locations (
            id,
            driver_id,
            location,
            heading,
            speed,
            accuracy,
            battery_level,
            timestamp
          ) VALUES ${values}
        `;

        await client.query(query, flatParams);
      });

      this.logger.debug(`Saved ${locationUpdates.length} location updates to database`);
    } catch (error) {
      this.logger.error(`Error saving batch locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Save a single driver location update
   */
  async saveLocation(locationUpdate: LocationUpdateDto): Promise<string> {
    try {
      const result = await this.databaseService.query<{ location_id: string }>(
        `INSERT INTO driver_locations (
          id,
          driver_id,
          location,
          heading,
          speed,
          accuracy,
          battery_level,
          timestamp
        ) VALUES (
          gen_random_uuid(),
          $1,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4,
          $5,
          $6,
          $7,
          $8
        ) RETURNING id AS location_id`,
        [
          locationUpdate.driverId,
          locationUpdate.longitude,
          locationUpdate.latitude,
          locationUpdate.heading || null,
          locationUpdate.speed || null,
          locationUpdate.accuracy || null,
          locationUpdate.batteryLevel || null,
          new Date()
        ]
      );
      
      return result.rows[0].location_id;
    } catch (error) {
      this.logger.error(`Error saving location: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get the latest location for a driver
   */
  async getLatestLocation(driverId: string): Promise<DbLocation | null> {
    try {
      const result = await this.databaseService.query<DbLocation>(
        `SELECT 
          dl.id, 
          dl.driver_id, 
          ST_X(dl.location::geometry) AS longitude, 
          ST_Y(dl.location::geometry) AS latitude,
          dl.heading,
          dl.speed,
          dl.accuracy,
          dl.battery_level as battery_level,
          dl.timestamp
         FROM driver_locations dl
         WHERE dl.driver_id = $1
         ORDER BY dl.timestamp DESC
         LIMIT 1`,
        [driverId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Convert database result to DbLocation type
      const dbLocation = result.rows[0];
      return {
        id: dbLocation.id,
        driver_id: dbLocation.driver_id,
        latitude: dbLocation.latitude,
        longitude: dbLocation.longitude,
        heading: dbLocation.heading,
        speed: dbLocation.speed,
        accuracy: dbLocation.accuracy,
        battery_level: dbLocation.battery_level,
        timestamp: dbLocation.timestamp
      };
    } catch (error) {
      this.logger.error(`Error getting latest location: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Find nearby drivers within a specified radius
   */
  async findNearbyDrivers(latitude: number, longitude: number, radiusMeters: number = 5000, limit: number = 10): Promise<NearbyDriver[]> {
    try {
      const result = await this.databaseService.query<NearbyDriver>(
        `SELECT * FROM find_nearby_drivers($1, $2, $3, $4)`,
        [latitude, longitude, radiusMeters, limit]
      );
      
      // Convert database results to NearbyDriver type
      return result.rows.map(row => ({
        driver_id: row.driver_id,
        distance_meters: row.distance_meters,
        last_updated: row.last_updated
      }));
    } catch (error) {
      this.logger.error(`Error finding nearby drivers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get location history for a driver within a time range
   */
  async getLocationHistory(driverId: string, startTime: Date, endTime: Date, limit: number = 100): Promise<DbLocation[]> {
    try {
      const result = await this.databaseService.query<DbLocation>(
        `SELECT 
          dl.id, 
          dl.driver_id, 
          ST_X(dl.location::geometry) AS longitude, 
          ST_Y(dl.location::geometry) AS latitude,
          dl.heading,
          dl.speed,
          dl.accuracy,
          dl.battery_level,
          dl.timestamp
         FROM driver_locations dl
         WHERE dl.driver_id = $1
           AND dl.timestamp BETWEEN $2 AND $3
         ORDER BY dl.timestamp DESC
         LIMIT $4`,
        [driverId, startTime, endTime, limit]
      );
      
      // Convert database results to DbLocation type
      return result.rows.map(row => ({
        id: row.id,
        driver_id: row.driver_id,
        latitude: row.latitude,
        longitude: row.longitude,
        heading: row.heading,
        speed: row.speed,
        accuracy: row.accuracy,
        battery_level: row.battery_level,
        timestamp: row.timestamp
      }));
    } catch (error) {
      this.logger.error(`Error getting location history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
