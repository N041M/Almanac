/**
 * Ambient weather seam (L6). One outbound call, behind a port. Every method may
 * return `null` when location/network is unavailable — consumers fall back to
 * their non-weather behaviour (L5). Adapter (Open-Meteo) lives in the weather
 * module; the core only defines the shape.
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherSnapshot {
  /** Temperature in degrees Celsius (units are a display concern, not storage). */
  temperatureC: number;
  /** WMO weather code (adapters map this to icons/labels). */
  weatherCode: number;
  /** The day this snapshot describes. */
  date: string;
}

export interface WeatherPort {
  current(at: GeoCoordinates): Promise<WeatherSnapshot | null>;
  forecast(at: GeoCoordinates, days: number): Promise<WeatherSnapshot[] | null>;
}
