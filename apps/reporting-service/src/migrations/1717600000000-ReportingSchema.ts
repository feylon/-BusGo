import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportingSchema1717600000000 implements MigrationInterface {
    name = 'ReportingSchema1717600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "report_bookings" ("bookingId" uuid NOT NULL, "code" character varying(12) NOT NULL, "userId" uuid NOT NULL, "tripId" uuid NOT NULL, "routeId" uuid NOT NULL, "routeName" character varying(150) NOT NULL, "busId" uuid, "driverId" uuid, "amount" integer NOT NULL DEFAULT '0', "seats" integer NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL, "cancelReason" character varying(60), "departureAt" TIMESTAMP WITH TIME ZONE, "confirmedAt" TIMESTAMP WITH TIME ZONE, "cancelledAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_30bffc0e07a4eed6f6e9177e101" PRIMARY KEY ("bookingId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3ddfdd13d6a960c6057784e7ba" ON "report_bookings" ("tripId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2282485098d44cd469c828b22c" ON "report_bookings" ("routeId", "confirmedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e8e183fd6394fa43f041dbaf6" ON "report_bookings" ("confirmedAt") `);
        await queryRunner.query(`CREATE TABLE "report_trips" ("tripId" uuid NOT NULL, "routeId" uuid NOT NULL, "routeName" character varying(150) NOT NULL, "busId" uuid NOT NULL, "busPlate" character varying(20), "driverId" uuid, "driverName" character varying(150), "capacity" integer NOT NULL DEFAULT '0', "soldSeats" integer NOT NULL DEFAULT '0', "revenue" integer NOT NULL DEFAULT '0', "delayMinutes" integer NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL, "departureAt" TIMESTAMP WITH TIME ZONE NOT NULL, "arrivalAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8d976d9b5a30040bb4c89e43ee0" PRIMARY KEY ("tripId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_86a4082eb8073c0193d285e788" ON "report_trips" ("routeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3481c139a240e5ec993a48109c" ON "report_trips" ("busId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d649abc5a6a7b49ce9120c6ec" ON "report_trips" ("driverId") `);
        await queryRunner.query(`CREATE INDEX "IDX_db0a8ca362196dea5124d1dfa8" ON "report_trips" ("departureAt") `);
        await queryRunner.query(`CREATE TABLE "report_payments" ("paymentId" uuid NOT NULL, "bookingId" uuid NOT NULL, "userId" uuid NOT NULL, "amount" integer NOT NULL, "status" character varying(20) NOT NULL, "provider" character varying(20) NOT NULL, "reason" character varying(60), "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_acc006d6b6daf8c5462f046b80d" PRIMARY KEY ("paymentId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f61c7b2014c0b37bf55d078042" ON "report_payments" ("occurredAt") `);
        await queryRunner.query(`CREATE TABLE "daily_summaries" ("date" date NOT NULL, "bookings" integer NOT NULL DEFAULT '0', "tickets" integer NOT NULL DEFAULT '0', "revenue" bigint NOT NULL DEFAULT '0', "cancelled" integer NOT NULL DEFAULT '0', "trips" integer NOT NULL DEFAULT '0', "passengers" integer NOT NULL DEFAULT '0', "details" jsonb NOT NULL DEFAULT '{}', "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_87c682542bf8bd6060acf58b12f" PRIMARY KEY ("date"))`);
        await queryRunner.query(`CREATE TABLE "processed_events" ("eventId" uuid NOT NULL, "handler" character varying(60) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b4d6bbd4bea3a359b9d99154deb" PRIMARY KEY ("eventId", "handler"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "processed_events"`);
        await queryRunner.query(`DROP TABLE "daily_summaries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f61c7b2014c0b37bf55d078042"`);
        await queryRunner.query(`DROP TABLE "report_payments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db0a8ca362196dea5124d1dfa8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1d649abc5a6a7b49ce9120c6ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3481c139a240e5ec993a48109c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_86a4082eb8073c0193d285e788"`);
        await queryRunner.query(`DROP TABLE "report_trips"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e8e183fd6394fa43f041dbaf6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2282485098d44cd469c828b22c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ddfdd13d6a960c6057784e7ba"`);
        await queryRunner.query(`DROP TABLE "report_bookings"`);
    }

}
