import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Point, Geofence } from '../interfaces';
import { GeofenceService } from './geofence.service';

/**
 * Event types for geofence events.
 */
export enum GeofenceEventType {
  ENTER = 'enter',
  EXIT = 'exit',
  DWELL = 'dwell', // Staying within a geofence for a period of time
}

/**
 * Interface for geofence event data.
 */
export interface GeofenceEvent {
  readonly type: GeofenceEventType;
  readonly geofence: Geofence;
  readonly entityId: string;
  readonly entityType: string;
  readonly location: Point;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Interface for tracking entity location history.
 */
interface EntityLocation {
  readonly entityId: string;
  readonly entityType: string;
  readonly location: Point;
  readonly timestamp: Date;
  readonly geofenceIds: Set<string>;
}

/**
 * Service for handling geofence events such as enter, exit, and dwell.
 */
@Injectable()
export class GeofenceEventService implements OnModuleInit {
  private readonly entityLocations: Map<string, EntityLocation>;
  private readonly dwellThresholdMs: number = 60000; // 1 minute
  private readonly dwellCheckIntervalMs: number = 30000; // 30 seconds
  private dwellCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly geofenceService: GeofenceService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.entityLocations = new Map<string, EntityLocation>();
  }

  /**
   * Sets up the dwell check interval when the module is initialized.
   */
  onModuleInit(): void {
    this.startDwellChecking();
  }

  /**
   * Updates the location of an entity and emits geofence events if needed.
   * 
   * @param entityId - Entity ID
   * @param entityType - Entity type (e.g., 'driver', 'customer')
   * @param location - Current location
   * @param metadata - Additional metadata
   * @returns Array of geofence events triggered by this update
   */
  public updateEntityLocation(
    entityId: string,
    entityType: string,
    location: Point,
    metadata?: Record<string, any>
  ): GeofenceEvent[] {
    const now: Date = new Date();
    const key: string = `${entityType}:${entityId}`;
    
    // Find geofences containing the current location
    const currentGeofences: Geofence[] = this.geofenceService.findGeofencesContainingPoint(location);
    const currentGeofenceIds: Set<string> = new Set(currentGeofences.map(g => g.id));
    
    // Get previous location data
    const previousLocation: EntityLocation | undefined = this.entityLocations.get(key);
    
    // Create events array
    const events: GeofenceEvent[] = [];
    
    if (previousLocation) {
      // Check for exit events
      for (const previousGeofenceId of previousLocation.geofenceIds) {
        if (!currentGeofenceIds.has(previousGeofenceId)) {
          // Entity has exited this geofence
          const geofence: Geofence | undefined = this.geofenceService.getGeofenceById(previousGeofenceId);
          
          if (geofence) {
            const exitEvent: GeofenceEvent = {
              type: GeofenceEventType.EXIT,
              geofence,
              entityId,
              entityType,
              location,
              timestamp: now,
              metadata
            };
            
            events.push(exitEvent);
            this.emitGeofenceEvent(exitEvent);
          }
        }
      }
      
      // Check for enter events
      for (const geofence of currentGeofences) {
        if (!previousLocation.geofenceIds.has(geofence.id)) {
          // Entity has entered this geofence
          const enterEvent: GeofenceEvent = {
            type: GeofenceEventType.ENTER,
            geofence,
            entityId,
            entityType,
            location,
            timestamp: now,
            metadata
          };
          
          events.push(enterEvent);
          this.emitGeofenceEvent(enterEvent);
        }
      }
    } else {
      // First location update, emit enter events for all geofences
      for (const geofence of currentGeofences) {
        const enterEvent: GeofenceEvent = {
          type: GeofenceEventType.ENTER,
          geofence,
          entityId,
          entityType,
          location,
          timestamp: now,
          metadata
        };
        
        events.push(enterEvent);
        this.emitGeofenceEvent(enterEvent);
      }
    }
    
    // Update entity location
    this.entityLocations.set(key, {
      entityId,
      entityType,
      location,
      timestamp: now,
      geofenceIds: currentGeofenceIds
    });
    
    return events;
  }

  /**
   * Gets the current location of an entity.
   * 
   * @param entityId - Entity ID
   * @param entityType - Entity type
   * @returns The entity location or undefined if not found
   */
  public getEntityLocation(entityId: string, entityType: string): EntityLocation | undefined {
    const key: string = `${entityType}:${entityId}`;
    return this.entityLocations.get(key);
  }

  /**
   * Gets all entities currently within a geofence.
   * 
   * @param geofenceId - Geofence ID
   * @returns Array of entity locations within the geofence
   */
  public getEntitiesInGeofence(geofenceId: string): EntityLocation[] {
    const result: EntityLocation[] = [];
    
    for (const location of this.entityLocations.values()) {
      if (location.geofenceIds.has(geofenceId)) {
        result.push(location);
      }
    }
    
    return result;
  }

  /**
   * Clears location data for an entity.
   * 
   * @param entityId - Entity ID
   * @param entityType - Entity type
   * @returns True if the entity was found and cleared, false otherwise
   */
  public clearEntityLocation(entityId: string, entityType: string): boolean {
    const key: string = `${entityType}:${entityId}`;
    return this.entityLocations.delete(key);
  }

  /**
   * Starts the interval for checking dwell events.
   */
  private startDwellChecking(): void {
    if (this.dwellCheckInterval) {
      clearInterval(this.dwellCheckInterval);
    }
    
    this.dwellCheckInterval = setInterval(() => {
      this.checkDwellEvents();
    }, this.dwellCheckIntervalMs);
  }

  /**
   * Checks for dwell events (entities staying in a geofence for a period of time).
   */
  private checkDwellEvents(): void {
    const now: Date = new Date();
    
    for (const location of this.entityLocations.values()) {
      // Check if the entity has been in any geofence long enough to trigger a dwell event
      const dwellThreshold: Date = new Date(now.getTime() - this.dwellThresholdMs);
      
      if (location.timestamp <= dwellThreshold) {
        // Entity has been in these geofences long enough
        for (const geofenceId of location.geofenceIds) {
          const geofence: Geofence | undefined = this.geofenceService.getGeofenceById(geofenceId);
          
          if (geofence) {
            const dwellEvent: GeofenceEvent = {
              type: GeofenceEventType.DWELL,
              geofence,
              entityId: location.entityId,
              entityType: location.entityType,
              location: location.location,
              timestamp: now
            };
            
            this.emitGeofenceEvent(dwellEvent);
          }
        }
      }
    }
  }

  /**
   * Emits a geofence event.
   * 
   * @param event - Geofence event
   */
  private emitGeofenceEvent(event: GeofenceEvent): void {
    const eventName: string = `geofence.${event.type}`;
    this.eventEmitter.emit(eventName, event);
    
    // Also emit a combined event for all geofence events
    this.eventEmitter.emit('geofence.event', event);
  }
}
