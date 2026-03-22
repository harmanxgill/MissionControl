export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Point {
  x: number;
  y: number;
}

export interface Obstacle {
  x: number;
  y: number;
  radius: number;
}

export interface DroneJobInput {
  start: Point;
  destination: Point;
  speed: number;
  obstacles: Obstacle[];
}

export interface FlightResult {
  waypoints: [number, number][];
  total_distance: number;
  straight_line_distance: number;
  route_efficiency: number;
  time_taken_seconds: number;
  fuel_used: number;
  waypoint_count: number;
  obstacles_avoided: number;
}

export interface Job {
  id: string;
  title: string;
  input_data: string;   // JSON string → DroneJobInput
  status: JobStatus;
  result: string | null; // JSON string → FlightResult
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface JobStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface CreateJobPayload {
  title: string;
  input_data: DroneJobInput;
}
