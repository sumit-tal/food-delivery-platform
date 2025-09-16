import { Point, Geofence } from '../interfaces';
import { GeoUtils } from '../utils/geo.utils';

/**
 * Interface for a cell in the grid index.
 */
interface GridCell {
  readonly id: string;
  readonly geofenceIds: Set<string>;
}

/**
 * Grid-based spatial index for efficient geofence lookups.
 * Uses a grid system to divide the world into cells for fast proximity searches.
 */
export class GridIndex {
  private readonly cells: Map<string, GridCell>;
  private readonly geofences: Map<string, Geofence>;
  private readonly cellSize: number; // Cell size in degrees

  /**
   * Creates a new grid index with the specified cell size.
   * 
   * @param cellSize - Cell size in degrees (default: 0.01, approximately 1km at the equator)
   */
  constructor(cellSize: number = 0.01) {
    this.cells = new Map<string, GridCell>();
    this.geofences = new Map<string, Geofence>();
    this.cellSize = cellSize;
  }

  /**
   * Adds a geofence to the spatial index.
   * 
   * @param geofence - The geofence to add
   */
  public addGeofence(geofence: Geofence): void {
    // Store the geofence
    this.geofences.set(geofence.id, geofence);
    
    // Calculate the bounding box of the geofence
    const points: Point[] = geofence.boundary.points;
    
    // Find min/max coordinates to create bounding box
    let minLat: number = 90;
    let minLng: number = 180;
    let maxLat: number = -90;
    let maxLng: number = -180;
    
    for (const point of points) {
      minLat = Math.min(minLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLat = Math.max(maxLat, point.latitude);
      maxLng = Math.max(maxLng, point.longitude);
    }
    
    // Add the geofence to all cells that intersect with its bounding box
    this.addGeofenceToCells(geofence.id, minLat, minLng, maxLat, maxLng);
  }

  /**
   * Removes a geofence from the spatial index.
   * 
   * @param geofenceId - ID of the geofence to remove
   * @returns True if the geofence was removed, false if it wasn't found
   */
  public removeGeofence(geofenceId: string): boolean {
    const geofence: Geofence | undefined = this.geofences.get(geofenceId);
    
    if (!geofence) {
      return false;
    }
    
    // Remove the geofence from all cells
    for (const [_, cell] of this.cells) {
      cell.geofenceIds.delete(geofenceId);
    }
    
    // Remove empty cells
    for (const [cellId, cell] of this.cells) {
      if (cell.geofenceIds.size === 0) {
        this.cells.delete(cellId);
      }
    }
    
    // Remove the geofence from the map
    this.geofences.delete(geofenceId);
    
    return true;
  }

  /**
   * Finds all geofences that contain the specified point.
   * 
   * @param point - The point to check
   * @returns Array of geofences containing the point
   */
  public findGeofencesContainingPoint(point: Point): Geofence[] {
    const cellId: string = this.getCellId(point.latitude, point.longitude);
    const cell: GridCell | undefined = this.cells.get(cellId);
    
    if (!cell) {
      return [];
    }
    
    const result: Geofence[] = [];
    
    for (const geofenceId of cell.geofenceIds) {
      const geofence: Geofence | undefined = this.geofences.get(geofenceId);
      
      if (geofence && GeoUtils.isPointInPolygon(point, geofence.boundary.points)) {
        result.push(geofence);
      }
    }
    
    return result;
  }

  /**
   * Finds all geofences within the specified radius of the point.
   * 
   * @param center - Center point for the search
   * @param radiusMeters - Search radius in meters
   * @returns Array of geofences within the radius
   */
  public findGeofencesWithinRadius(center: Point, radiusMeters: number): Geofence[] {
    // Calculate bounding box for the search radius
    const [minLat, minLng, maxLat, maxLng]: [number, number, number, number] = 
      GeoUtils.calculateBoundingBox(center, radiusMeters);
    
    // Get all cells that intersect with the bounding box
    const candidateCells: GridCell[] = this.getCellsInBoundingBox(minLat, minLng, maxLat, maxLng);
    
    // Set to avoid duplicate geofence IDs
    const geofenceIds: Set<string> = new Set<string>();
    
    // Collect all geofence IDs from the candidate cells
    for (const cell of candidateCells) {
      for (const geofenceId of cell.geofenceIds) {
        geofenceIds.add(geofenceId);
      }
    }
    
    const result: Geofence[] = [];
    
    // Check each candidate geofence
    for (const geofenceId of geofenceIds) {
      const geofence: Geofence | undefined = this.geofences.get(geofenceId);
      
      if (geofence) {
        // Calculate distance to the geofence center
        const distance: number = GeoUtils.calculateDistance(center, geofence.center);
        
        // If the geofence center is within the radius, add it to the result
        if (distance <= radiusMeters) {
          result.push(geofence);
        }
      }
    }
    
    return result;
  }

  /**
   * Gets all geofences in the index.
   * 
   * @returns Array of all geofences
   */
  public getAllGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Gets the number of geofences in the index.
   * 
   * @returns Number of geofences
   */
  public getGeofenceCount(): number {
    return this.geofences.size;
  }

  /**
   * Adds a geofence to all cells that intersect with its bounding box.
   * 
   * @param geofenceId - ID of the geofence to add
   * @param minLat - Minimum latitude of the bounding box
   * @param minLng - Minimum longitude of the bounding box
   * @param maxLat - Maximum latitude of the bounding box
   * @param maxLng - Maximum longitude of the bounding box
   */
  private addGeofenceToCells(
    geofenceId: string, 
    minLat: number, 
    minLng: number, 
    maxLat: number, 
    maxLng: number
  ): void {
    // Calculate cell indices
    const minLatIdx: number = Math.floor(minLat / this.cellSize);
    const minLngIdx: number = Math.floor(minLng / this.cellSize);
    const maxLatIdx: number = Math.floor(maxLat / this.cellSize);
    const maxLngIdx: number = Math.floor(maxLng / this.cellSize);
    
    // Add the geofence to all cells in the bounding box
    for (let latIdx: number = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
      for (let lngIdx: number = minLngIdx; lngIdx <= maxLngIdx; lngIdx++) {
        const cellId: string = `${latIdx}:${lngIdx}`;
        
        if (!this.cells.has(cellId)) {
          this.cells.set(cellId, {
            id: cellId,
            geofenceIds: new Set<string>()
          });
        }
        
        const cell: GridCell = this.cells.get(cellId)!;
        cell.geofenceIds.add(geofenceId);
      }
    }
  }

  /**
   * Gets all cells that intersect with the specified bounding box.
   * 
   * @param minLat - Minimum latitude of the bounding box
   * @param minLng - Minimum longitude of the bounding box
   * @param maxLat - Maximum latitude of the bounding box
   * @param maxLng - Maximum longitude of the bounding box
   * @returns Array of cells that intersect with the bounding box
   */
  private getCellsInBoundingBox(
    minLat: number, 
    minLng: number, 
    maxLat: number, 
    maxLng: number
  ): GridCell[] {
    // Calculate cell indices
    const minLatIdx: number = Math.floor(minLat / this.cellSize);
    const minLngIdx: number = Math.floor(minLng / this.cellSize);
    const maxLatIdx: number = Math.floor(maxLat / this.cellSize);
    const maxLngIdx: number = Math.floor(maxLng / this.cellSize);
    
    const result: GridCell[] = [];
    
    // Collect all cells in the bounding box
    for (let latIdx: number = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
      for (let lngIdx: number = minLngIdx; lngIdx <= maxLngIdx; lngIdx++) {
        const cellId: string = `${latIdx}:${lngIdx}`;
        const cell: GridCell | undefined = this.cells.get(cellId);
        
        if (cell) {
          result.push(cell);
        }
      }
    }
    
    return result;
  }

  /**
   * Gets the cell ID for the specified coordinates.
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Cell ID
   */
  private getCellId(lat: number, lng: number): string {
    const latIdx: number = Math.floor(lat / this.cellSize);
    const lngIdx: number = Math.floor(lng / this.cellSize);
    
    return `${latIdx}:${lngIdx}`;
  }
}
