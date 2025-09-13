import { Injectable, Logger } from '@nestjs/common';
import { VirtualDriver } from '../interfaces/virtual-driver.interface';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for visualizing driver simulation data
 */
@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);
  private readonly visualizationDir = path.join(process.cwd(), 'visualization');

  constructor() {
    this.ensureVisualizationDirExists();
  }

  /**
   * Ensure the visualization directory exists
   */
  private ensureVisualizationDirExists(): void {
    if (!fs.existsSync(this.visualizationDir)) {
      fs.mkdirSync(this.visualizationDir, { recursive: true });
      this.logger.log(`Created visualization directory: ${this.visualizationDir}`);
    }
  }

  /**
   * Generate a visualization HTML file for the current driver positions
   */
  async generateVisualization(drivers: VirtualDriver[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `driver-visualization-${timestamp}.html`;
    const filePath = path.join(this.visualizationDir, filename);

    const html = this.generateHtml(drivers);

    fs.writeFileSync(filePath, html);
    this.logger.log(`Generated visualization at: ${filePath}`);

    return filePath;
  }

  /**
   * Generate HTML content for visualization
   */
  private generateHtml(drivers: VirtualDriver[]): string {
    // Calculate the center point of all drivers
    const center = this.calculateCenter(drivers);

    // Generate markers for each driver
    const markers = drivers
      .map((driver) => {
        return `
        // Driver ${driver.id}
        new google.maps.Marker({
          position: { lat: ${driver.latitude}, lng: ${driver.longitude} },
          map: map,
          title: 'Driver ${driver.id.substring(0, 8)}',
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            rotation: ${driver.heading},
            scale: 4,
            fillColor: '${this.getDriverStatusColor(driver.status)}',
            fillOpacity: 0.8,
            strokeWeight: 1,
            strokeColor: '#000000'
          }
        });
      `;
      })
      .join('\n');

    // Generate info window content
    const infoWindows = drivers
      .map((driver) => {
        const content = `
        <div>
          <h3>Driver ${driver.id.substring(0, 8)}</h3>
          <p>Status: ${driver.status}</p>
          <p>Speed: ${driver.speed.toFixed(1)} km/h</p>
          <p>Heading: ${driver.heading.toFixed(1)}°</p>
          <p>Battery: ${driver.batteryLevel.toFixed(1)}%</p>
          <p>Position: ${driver.latitude.toFixed(5)}, ${driver.longitude.toFixed(5)}</p>
        </div>
      `;

        return `
        // Info window for driver ${driver.id}
        const infoWindow${driver.id.replace(/-/g, '_')} = new google.maps.InfoWindow({
          content: ${JSON.stringify(content)}
        });

        marker${driver.id.replace(/-/g, '_')}.addListener('click', () => {
          infoWindow${driver.id.replace(/-/g, '_')}.open(map, marker${driver.id.replace(/-/g, '_')});
        });
      `;
      })
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Driver Simulator Visualization</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body, html {
              height: 100%;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            #map {
              height: 100%;
            }
            .controls {
              position: absolute;
              top: 10px;
              left: 10px;
              z-index: 1000;
              background: white;
              padding: 10px;
              border-radius: 4px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }
            .legend {
              position: absolute;
              bottom: 30px;
              right: 10px;
              z-index: 1000;
              background: white;
              padding: 10px;
              border-radius: 4px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }
            .legend-item {
              display: flex;
              align-items: center;
              margin-bottom: 5px;
            }
            .legend-color {
              width: 20px;
              height: 20px;
              margin-right: 10px;
              border: 1px solid #000;
            }
            .timestamp {
              position: absolute;
              bottom: 10px;
              left: 10px;
              z-index: 1000;
              background: white;
              padding: 5px 10px;
              border-radius: 4px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <div class="controls">
            <h3>Driver Simulator</h3>
            <p>Active Drivers: ${drivers.length}</p>
            <button id="refreshBtn">Refresh</button>
            <button id="autoRefreshBtn">Auto Refresh</button>
            <span id="refreshStatus"></span>
          </div>
          <div class="legend">
            <h4>Driver Status</h4>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #4CAF50;"></div>
              <span>Available</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #2196F3;"></div>
              <span>En Route</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #FFC107;"></div>
              <span>Busy</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #F44336;"></div>
              <span>Offline</span>
            </div>
          </div>
          <div class="timestamp">
            Generated: ${new Date().toLocaleString()}
          </div>

          <script>
            let map;
            let autoRefreshInterval;

            function initMap() {
              map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: ${center.latitude}, lng: ${center.longitude} },
                zoom: 13,
                mapTypeId: 'roadmap'
              });

              // Add markers for each driver
              ${markers}

              // Add info windows
              ${infoWindows}

              // Set up refresh button
              document.getElementById('refreshBtn').addEventListener('click', () => {
                window.location.reload();
              });

              // Set up auto refresh
              document.getElementById('autoRefreshBtn').addEventListener('click', toggleAutoRefresh);
            }

            function toggleAutoRefresh() {
              const statusEl = document.getElementById('refreshStatus');
              const button = document.getElementById('autoRefreshBtn');

              if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                statusEl.textContent = '';
                button.textContent = 'Auto Refresh';
              } else {
                statusEl.textContent = 'Auto-refreshing every 5s';
                button.textContent = 'Stop Auto Refresh';
                autoRefreshInterval = setInterval(() => {
                  window.location.reload();
                }, 5000);
              }
            }
          </script>
          <script async defer
            src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap">
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Calculate the center point of all drivers
   */
  private calculateCenter(drivers: VirtualDriver[]): { latitude: number; longitude: number } {
    if (drivers.length === 0) {
      return { latitude: 0, longitude: 0 };
    }

    let sumLat = 0;
    let sumLng = 0;

    for (const driver of drivers) {
      sumLat += driver.latitude;
      sumLng += driver.longitude;
    }

    return {
      latitude: sumLat / drivers.length,
      longitude: sumLng / drivers.length,
    };
  }

  /**
   * Get color based on driver status
   */
  private getDriverStatusColor(status: string): string {
    switch (status) {
      case 'available':
        return '#4CAF50'; // Green
      case 'en_route':
        return '#2196F3'; // Blue
      case 'busy':
        return '#FFC107'; // Amber
      case 'offline':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
  }

  /**
   * Generate a GeoJSON file with driver positions
   */
  async generateGeoJson(drivers: VirtualDriver[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `driver-positions-${timestamp}.geojson`;
    const filePath = path.join(this.visualizationDir, filename);

    const features = drivers.map((driver) => {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [driver.longitude, driver.latitude],
        },
        properties: {
          id: driver.id,
          heading: driver.heading,
          speed: driver.speed,
          batteryLevel: driver.batteryLevel,
          accuracy: driver.accuracy,
          status: driver.status,
        },
      };
    });

    const geoJson = {
      type: 'FeatureCollection',
      features,
    };

    fs.writeFileSync(filePath, JSON.stringify(geoJson, null, 2));
    this.logger.log(`Generated GeoJSON at: ${filePath}`);

    return filePath;
  }
}
