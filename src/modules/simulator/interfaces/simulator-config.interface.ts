/**
 * Interface for simulator configuration
 */
export interface SimulatorConfig {
  /**
   * Number of virtual drivers to simulate
   */
  readonly driverCount: number;
  
  /**
   * Update frequency in milliseconds
   */
  readonly updateFrequencyMs: number;
  
  /**
   * Whether to automatically start the simulator on initialization
   */
  readonly autoStart: boolean;
  
  /**
   * Initial region for driver placement
   */
  readonly initialRegion: {
    /**
     * Center latitude of the region
     */
    readonly centerLat: number;
    
    /**
     * Center longitude of the region
     */
    readonly centerLng: number;
    
    /**
     * Radius of the region in kilometers
     */
    readonly radiusKm: number;
  };
}
