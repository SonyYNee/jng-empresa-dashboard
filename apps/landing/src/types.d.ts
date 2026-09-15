export type EventStatus = 'available' | 'last-seats' | 'sold-out' | 'ended' | 'coming-soon';
export interface Event {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  poster: string;
  date: string;
  endDate: string;
  city: string;
  venue: string;
  departureLocation: string;
  returnTime: string;
  price: number | null;
  seatsAvailable: number | null;
  status: EventStatus;
  featured: boolean;
  priority?: boolean;
  demo: boolean;
}
export interface Trip {
  id: string;
  slug: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  image: string;
  price: number | null;
  availableSeats: number | null;
  category: string;
  demo: boolean;
}
export interface Vehicle {
  id: string;
  name: string;
  category: string;
  image: string;
  capacity: number | null;
  amenities: string[];
  use: string;
  demo: boolean;
}
export interface TravelRequest {
  type: string;
  origin: string;
  destination: string;
  date: string;
  returnDate?: string;
  departureTime?: string;
  returnTime?: string;
  passengers: number;
  name: string;
  phone: string;
  email: string;
  notes?: string;
  event?: string;
  trip?: string;
  vehicle?: string;
  boarding?: string;
}
export interface DemoResult {
  mode: 'demo';
  sent: false;
  data: TravelRequest;
}
