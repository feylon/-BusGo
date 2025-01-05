import { MigrationInterface, QueryRunner } from "typeorm";

export class TrackingSchema1717400000000 implements MigrationInterface {
    name = 'TrackingSchema1717400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "location_history" ("id" BIGSERIAL NOT NULL, "tripId" uuid NOT NULL, "vehicleId" uuid NOT NULL, "driverId" uuid NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "speed" real NOT NULL DEFAULT '0', "heading" real NOT NULL DEFAULT '0', "accuracy" real NOT NULL DEFAULT '0', "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_969935adbd171d824b649bc03d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8090f56dad3cb3f8a2f4a0f590" ON "location_history" ("vehicleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5449f667f838da2c660b4527a7" ON "location_history" ("tripId", "recordedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_5449f667f838da2c660b4527a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8090f56dad3cb3f8a2f4a0f590"`);
        await queryRunner.query(`DROP TABLE "location_history"`);
    }

}
