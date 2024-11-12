import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DailySummary } from './read-model.entity';

const TZ = 'Asia/Tashkent';

export interface ReportQuery {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'week' | 'month';
  routeId?: string;
}

const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

@Injectable()
export class ReportsService {
  constructor(private readonly ds: DataSource) {}

  range(q: ReportQuery) {
    const to = q.to ?? localDate(new Date());
    const from = q.from ?? localDate(new Date(Date.now() - 29 * 86400000));
    return { from, to };
  }

  private local(col: string) {
    return `(${col} AT TIME ZONE '${TZ}')::date`;
  }

  async dashboard(q: ReportQuery) {
    const { from, to } = this.range(q);
    const d = this.local('"confirmedAt"');
    const [totals] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS bookings,
              COALESCE(SUM(seats) FILTER (WHERE status = 'CONFIRMED'),0)::int AS tickets,
              COALESCE(SUM(amount) FILTER (WHERE status = 'CONFIRMED'),0)::bigint AS revenue,
              COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
              COUNT(DISTINCT "userId")::int AS passengers
         FROM report_bookings WHERE ${d} BETWEEN $1 AND $2`,
      [from, to],
    );
    const [trips] = await this.ds.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
              COALESCE(ROUND(100.0 * SUM("soldSeats") FILTER (WHERE status <> 'CANCELLED') / NULLIF(SUM(capacity) FILTER (WHERE status <> 'CANCELLED'),0), 1),0)::float AS occupancy
         FROM report_trips WHERE ${this.local('"departureAt"')} BETWEEN $1 AND $2`,
      [from, to],
    );
    const [payments] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::int AS succeeded,
              COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'REFUNDED')::int AS refunded
         FROM report_payments WHERE ${this.local('"occurredAt"')} BETWEEN $1 AND $2`,
      [from, to],
    );
    const series = await this.sales({ from, to, groupBy: 'day' });
    const topRoutes = (await this.routes({ from, to })).slice(0, 5);
    const revenue = Number(totals.revenue);
    const attempts = payments.succeeded + payments.failed;
    return {
      range: { from, to },
      revenue,
      bookings: totals.bookings,
      tickets: totals.tickets,
      cancelled: totals.cancelled,
      passengers: totals.passengers,
      avgTicketPrice: totals.tickets ? Math.round(revenue / totals.tickets) : 0,
      trips,
      payments: { ...payments, successRate: attempts ? Math.round((1000 * payments.succeeded) / attempts) / 10 : 100 },
      series: series.items,
      topRoutes,
    };
  }

  async sales(q: ReportQuery) {
    const { from, to } = this.range(q);
    const unit = q.groupBy === 'month' ? 'month' : q.groupBy === 'week' ? 'week' : 'day';
    const rows = await this.ds.query(
      `WITH periods AS (
         SELECT generate_series(date_trunc($3, $1::date), date_trunc($3, $2::date), ('1 ' || $3)::interval)::date AS period
       ), sales AS (
         SELECT date_trunc($3, ${this.local('"confirmedAt"')})::date AS period,
                SUM(amount) FILTER (WHERE status = 'CONFIRMED') AS revenue,
                SUM(seats) FILTER (WHERE status = 'CONFIRMED') AS tickets,
                COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS bookings,
                COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled
           FROM report_bookings
          WHERE ${this.local('"confirmedAt"')} BETWEEN $1 AND $2 ${q.routeId ? 'AND "routeId" = $4' : ''}
          GROUP BY 1)
       SELECT to_char(p.period, 'YYYY-MM-DD') AS period,
              COALESCE(s.revenue,0)::bigint AS revenue, COALESCE(s.tickets,0)::int AS tickets,
              COALESCE(s.bookings,0)::int AS bookings, COALESCE(s.cancelled,0)::int AS cancelled
         FROM periods p LEFT JOIN sales s ON s.period = p.period ORDER BY p.period`,
      q.routeId ? [from, to, unit, q.routeId] : [from, to, unit],
    );
    return { range: { from, to }, groupBy: unit, items: rows.map((r: any) => ({ ...r, revenue: Number(r.revenue) })) };
  }

  async routes(q: ReportQuery) {
    const { from, to } = this.range(q);
    const rows = await this.ds.query(
      `SELECT t."routeId", MAX(t."routeName") AS "routeName",
              COUNT(*)::int AS trips,
              COALESCE(SUM(t."soldSeats"),0)::int AS tickets,
              COALESCE(SUM(t.revenue),0)::bigint AS revenue,
              COALESCE(ROUND(100.0 * SUM(t."soldSeats") / NULLIF(SUM(t.capacity),0), 1),0)::float AS occupancy
         FROM report_trips t
        WHERE ${this.local('t."departureAt"')} BETWEEN $1 AND $2 AND t.status <> 'CANCELLED'
        GROUP BY t."routeId" ORDER BY revenue DESC`,
      [from, to],
    );
    return rows.map((r: any) => ({ ...r, revenue: Number(r.revenue) }));
  }

  async buses(q: ReportQuery) {
    const { from, to } = this.range(q);
    return this.ds.query(
      `SELECT t."busId", MAX(t."busPlate") AS "plateNumber",
              COUNT(*)::int AS trips,
              COALESCE(SUM(t.capacity),0)::int AS "seatCapacity",
              COALESCE(SUM(t."soldSeats"),0)::int AS "soldSeats",
              COALESCE(ROUND(100.0 * SUM(t."soldSeats") / NULLIF(SUM(t.capacity),0), 1),0)::float AS utilization,
              COALESCE(SUM(t.revenue),0)::int AS revenue,
              COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (t."arrivalAt" - t."departureAt")) / 3600) FILTER (WHERE t.status = 'COMPLETED'), 1),0)::float AS "hoursOnRoad"
         FROM report_trips t
        WHERE ${this.local('t."departureAt"')} BETWEEN $1 AND $2 AND t.status <> 'CANCELLED'
        GROUP BY t."busId" ORDER BY utilization DESC`,
      [from, to],
    );
  }

  async drivers(q: ReportQuery) {
    const { from, to } = this.range(q);
    return this.ds.query(
      `SELECT t."driverId", MAX(t."driverName") AS "driverName",
              COUNT(*)::int AS trips,
              COUNT(*) FILTER (WHERE t.status = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE t."delayMinutes" > 0)::int AS delayed,
              COALESCE(ROUND(AVG(t."delayMinutes") FILTER (WHERE t."delayMinutes" > 0)),0)::int AS "avgDelayMin",
              COALESCE(SUM(t."soldSeats"),0)::int AS passengers,
              COALESCE(SUM(t.revenue),0)::int AS revenue
         FROM report_trips t
        WHERE t."driverId" IS NOT NULL AND ${this.local('t."departureAt"')} BETWEEN $1 AND $2 AND t.status <> 'CANCELLED'
        GROUP BY t."driverId" ORDER BY trips DESC`,
      [from, to],
    );
  }

  async trips(q: ReportQuery) {
    const { from, to } = this.range(q);
    const byStatus = await this.ds.query(
      `SELECT status, COUNT(*)::int AS count FROM report_trips
        WHERE ${this.local('"departureAt"')} BETWEEN $1 AND $2 GROUP BY status ORDER BY count DESC`,
      [from, to],
    );
    const byHour = await this.ds.query(
      `SELECT EXTRACT(HOUR FROM ("departureAt" AT TIME ZONE '${TZ}'))::int AS hour, COUNT(*)::int AS trips,
              COALESCE(SUM("soldSeats"),0)::int AS tickets
         FROM report_trips WHERE ${this.local('"departureAt"')} BETWEEN $1 AND $2 AND status <> 'CANCELLED'
        GROUP BY 1 ORDER BY 1`,
      [from, to],
    );
    const [delay] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE "delayMinutes" > 0)::int AS delayed,
              COALESCE(ROUND(AVG("delayMinutes") FILTER (WHERE "delayMinutes" > 0)),0)::int AS "avgDelayMin"
         FROM report_trips WHERE ${this.local('"departureAt"')} BETWEEN $1 AND $2`,
      [from, to],
    );
    return { range: { from, to }, byStatus, byHour, ...delay };
  }

  async payments(q: ReportQuery) {
    const { from, to } = this.range(q);
    const byStatus = await this.ds.query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::bigint AS amount FROM report_payments
        WHERE ${this.local('"occurredAt"')} BETWEEN $1 AND $2 GROUP BY status ORDER BY count DESC`,
      [from, to],
    );
    const byProvider = await this.ds.query(
      `SELECT provider, COUNT(*)::int AS count, COALESCE(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'),0)::bigint AS amount
         FROM report_payments WHERE ${this.local('"occurredAt"')} BETWEEN $1 AND $2 GROUP BY provider`,
      [from, to],
    );
    const series = await this.ds.query(
      `SELECT to_char(${this.local('"occurredAt"')}, 'YYYY-MM-DD') AS day,
              COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::int AS succeeded,
              COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'REFUNDED')::int AS refunded
         FROM report_payments WHERE ${this.local('"occurredAt"')} BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
      [from, to],
    );
    const num = (rows: any[]) => rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    return { range: { from, to }, byStatus: num(byStatus), byProvider: num(byProvider), series };
  }

  async passengers(q: ReportQuery) {
    const { from, to } = this.range(q);
    const [summary] = await this.ds.query(
      `WITH first AS (SELECT "userId", MIN("confirmedAt") AS first_at FROM report_bookings WHERE status = 'CONFIRMED' GROUP BY "userId")
       SELECT COUNT(DISTINCT b."userId")::int AS active,
              COUNT(DISTINCT b."userId") FILTER (WHERE ${this.local('f.first_at')} BETWEEN $1 AND $2)::int AS "new",
              COALESCE(SUM(b.seats),0)::int AS tickets
         FROM report_bookings b JOIN first f ON f."userId" = b."userId"
        WHERE b.status = 'CONFIRMED' AND ${this.local('b."confirmedAt"')} BETWEEN $1 AND $2`,
      [from, to],
    );
    const top = await this.ds.query(
      `SELECT "userId", COUNT(*)::int AS bookings, SUM(seats)::int AS tickets, SUM(amount)::bigint AS spent
         FROM report_bookings WHERE status = 'CONFIRMED' AND ${this.local('"confirmedAt"')} BETWEEN $1 AND $2
        GROUP BY "userId" ORDER BY spent DESC LIMIT 10`,
      [from, to],
    );
    return {
      range: { from, to },
      ...summary,
      returning: summary.active - summary.new,
      top: top.map((t: any) => ({ ...t, spent: Number(t.spent) })),
    };
  }

  async cancellations(q: ReportQuery) {
    const { from, to } = this.range(q);
    const byReason = await this.ds.query(
      `SELECT COALESCE("cancelReason", 'UNKNOWN') AS reason, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::bigint AS amount
         FROM report_bookings WHERE status = 'CANCELLED' AND ${this.local('"cancelledAt"')} BETWEEN $1 AND $2
        GROUP BY 1 ORDER BY count DESC`,
      [from, to],
    );
    const [rate] = await this.ds.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
         FROM report_bookings WHERE ${this.local('"confirmedAt"')} BETWEEN $1 AND $2`,
      [from, to],
    );
    return {
      range: { from, to },
      byReason: byReason.map((r: any) => ({ ...r, amount: Number(r.amount) })),
      rate: rate.total ? Math.round((1000 * rate.cancelled) / rate.total) / 10 : 0,
      ...rate,
    };
  }

  async daily(q: ReportQuery) {
    const { from, to } = this.range(q);
    return this.ds
      .getRepository(DailySummary)
      .createQueryBuilder('d')
      .where('d.date BETWEEN :from AND :to', { from, to })
      .orderBy('d.date', 'DESC')
      .getMany();
  }

  async buildDaily(date?: string) {
    const day = date ?? localDate(new Date(Date.now() - 86400000));
    const dash = await this.dashboard({ from: day, to: day });
    const routes = await this.routes({ from: day, to: day });
    const summary = {
      date: day,
      bookings: dash.bookings,
      tickets: dash.tickets,
      revenue: String(dash.revenue),
      cancelled: dash.cancelled,
      trips: dash.trips.total,
      passengers: dash.passengers,
      details: { occupancy: dash.trips.occupancy, payments: dash.payments, routes },
      generatedAt: new Date(),
    };
    await this.ds.getRepository(DailySummary).save(summary);
    return summary;
  }
}
