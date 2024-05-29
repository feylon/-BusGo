export enum RoleName {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DISPATCHER = 'DISPATCHER',
  DRIVER = 'DRIVER',
  PASSENGER = 'PASSENGER',
}

export const PERMISSIONS = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'drivers.read',
  'drivers.manage',
  'passengers.read',
  'buses.read',
  'buses.create',
  'buses.update',
  'buses.delete',
  'routes.read',
  'routes.manage',
  'stops.read',
  'stops.manage',
  'trips.read',
  'trips.create',
  'trips.update',
  'trips.cancel',
  'pricing.read',
  'pricing.manage',
  'bookings.read',
  'bookings.create',
  'bookings.cancel',
  'tickets.read',
  'tickets.verify',
  'tracking.read',
  'tracking.send',
  'responsibles.read',
  'responsibles.manage',
  'notifications.manage',
  'reports.read',
  'audit.read',
  'settings.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const all = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [RoleName.SUPER_ADMIN]: all,
  [RoleName.ADMIN]: all.filter((p) => p !== 'users.delete' && p !== 'tracking.send'),
  [RoleName.DISPATCHER]: [
    'drivers.read',
    'passengers.read',
    'buses.read',
    'routes.read',
    'stops.read',
    'trips.read',
    'trips.create',
    'trips.update',
    'trips.cancel',
    'pricing.read',
    'bookings.read',
    'bookings.create',
    'bookings.cancel',
    'tickets.read',
    'tickets.verify',
    'tracking.read',
    'responsibles.read',
    'reports.read',
  ],
  [RoleName.DRIVER]: ['trips.read', 'tickets.verify', 'tracking.send', 'tracking.read', 'routes.read', 'stops.read'],
  [RoleName.PASSENGER]: ['routes.read', 'stops.read', 'trips.read', 'bookings.create', 'tracking.read'],
};

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum BusStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum SeatType {
  STANDARD = 'STANDARD',
  COMFORT = 'COMFORT',
  VIP = 'VIP',
  ACCESSIBLE = 'ACCESSIBLE',
}

export enum SeatPosition {
  WINDOW = 'WINDOW',
  MIDDLE = 'MIDDLE',
  AISLE = 'AISLE',
}

export enum BusSeatStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  DISABLED = 'DISABLED',
}

export enum LayoutCellKind {
  SEAT = 'SEAT',
  AISLE = 'AISLE',
  DRIVER = 'DRIVER',
  DOOR = 'DOOR',
  EMPTY = 'EMPTY',
}

export interface LayoutCell {
  row: number;
  col: number;
  kind: LayoutCellKind;
  number?: string;
  type?: SeatType;
  status?: BusSeatStatus;
}

export interface BusLayout {
  rows: number;
  cols: number;
  cells: LayoutCell[];
}

export enum TripSeatStatus {
  AVAILABLE = 'AVAILABLE',
  LOCKED = 'LOCKED',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  BLOCKED = 'BLOCKED',
}

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  BOARDING = 'BOARDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DELAYED = 'DELAYED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const BOOKABLE_TRIP_STATUSES = [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DELAYED];

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
}

export enum TicketStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum VerificationResult {
  VALID = 'VALID',
  ALREADY_USED = 'ALREADY_USED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  INVALID = 'INVALID',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum NotificationType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_EXPIRED = 'BOOKING_EXPIRED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  TRIP_REMINDER = 'TRIP_REMINDER',
  TRIP_DELAYED = 'TRIP_DELAYED',
  TRIP_CANCELLED = 'TRIP_CANCELLED',
  TRIP_STARTED = 'TRIP_STARTED',
  TICKET_CREATED = 'TICKET_CREATED',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  SMS = 'SMS',
}

export enum ResponsibleEntity {
  TRIP = 'TRIP',
  ROUTE = 'ROUTE',
  BUS = 'BUS',
  REGION = 'REGION',
}

export enum Lang {
  UZ = 'uz',
  RU = 'ru',
  EN = 'en',
}

export const LANGS: Lang[] = [Lang.UZ, Lang.RU, Lang.EN];

export type Localized = Record<Lang, string>;

export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  DRIVER_CREATED = 'DRIVER_CREATED',
  DRIVER_UPDATED = 'DRIVER_UPDATED',
  BUS_CREATED = 'BUS_CREATED',
  BUS_UPDATED = 'BUS_UPDATED',
  BUS_DELETED = 'BUS_DELETED',
  SEAT_LAYOUT_UPDATED = 'SEAT_LAYOUT_UPDATED',
  SEAT_BLOCKED = 'SEAT_BLOCKED',
  STOP_CREATED = 'STOP_CREATED',
  STOP_UPDATED = 'STOP_UPDATED',
  STOP_DELETED = 'STOP_DELETED',
  ROUTE_CREATED = 'ROUTE_CREATED',
  ROUTE_UPDATED = 'ROUTE_UPDATED',
  ROUTE_DELETED = 'ROUTE_DELETED',
  TRIP_CREATED = 'TRIP_CREATED',
  TRIP_UPDATED = 'TRIP_UPDATED',
  TRIP_STATUS_CHANGED = 'TRIP_STATUS_CHANGED',
  TRIP_CANCELLED = 'TRIP_CANCELLED',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  PRICE_CREATED = 'PRICE_CREATED',
  PRICE_UPDATED = 'PRICE_UPDATED',
  PRICE_DELETED = 'PRICE_DELETED',
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  TICKET_VERIFIED = 'TICKET_VERIFIED',
  RESPONSIBLE_CREATED = 'RESPONSIBLE_CREATED',
  RESPONSIBLE_UPDATED = 'RESPONSIBLE_UPDATED',
  RESPONSIBLE_DELETED = 'RESPONSIBLE_DELETED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  NOTIFICATION_BROADCAST = 'NOTIFICATION_BROADCAST',
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LocationPoint {
  tripId: string;
  vehicleId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
}

export interface VehicleLocation extends LocationPoint {
  online: boolean;
  lastSeen: string;
  distanceLeftKm: number | null;
  etaMinutes: number | null;
  etaAt: string | null;
  tripStatus?: string;
}

export function seatPosition(col: number, cols: number, isAisle: (c: number) => boolean): SeatPosition {
  if (col === 0 || col === cols - 1) return SeatPosition.WINDOW;
  if (isAisle(col - 1) || isAisle(col + 1)) return SeatPosition.AISLE;
  return SeatPosition.MIDDLE;
}

export function buildStandardLayout(
  rows: number,
  left = 2,
  right = 2,
  opts: { lastRowFull?: boolean; vipRows?: number } = {},
): BusLayout {
  const cols = left + 1 + right;
  const aisle = left;
  const cells: LayoutCell[] = [];
  cells.push({ row: 0, col: 0, kind: LayoutCellKind.DRIVER });
  cells.push({ row: 0, col: cols - 1, kind: LayoutCellKind.DOOR });
  let n = 1;
  for (let r = 1; r <= rows; r++) {
    const full = opts.lastRowFull !== false && r === rows;
    for (let c = 0; c < cols; c++) {
      if (c === aisle && !full) {
        cells.push({ row: r, col: c, kind: LayoutCellKind.AISLE });
        continue;
      }
      const type = r <= (opts.vipRows ?? 0) ? SeatType.VIP : SeatType.STANDARD;
      cells.push({
        row: r,
        col: c,
        kind: LayoutCellKind.SEAT,
        number: String(n++).padStart(2, '0'),
        type,
        status: BusSeatStatus.ACTIVE,
      });
    }
  }
  return { rows: rows + 1, cols, cells };
}
