import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditSchema1717300000000 implements MigrationInterface {
    name = 'AuditSchema1717300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "userId" uuid, "userRole" character varying(30), "action" character varying(60) NOT NULL, "entity" character varying(60), "entityId" character varying(64), "method" character varying(10), "endpoint" character varying(255), "ipAddress" character varying(64), "userAgent" character varying(255), "metadata" jsonb NOT NULL DEFAULT '{}', "correlationId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_f953f2cb581d00109a05741e13f" UNIQUE ("eventId"), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cfa83f61e4d27a87fcae1e025a" ON "audit_logs" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ddc86298ac7fadad468b28d83" ON "audit_logs" ("ipAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_2643f2a68c662985433dbddca1" ON "audit_logs" ("entity", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ec936941eb8556fcd7a1f0eae" ON "audit_logs" ("action", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs" ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ec936941eb8556fcd7a1f0eae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2643f2a68c662985433dbddca1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ddc86298ac7fadad468b28d83"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cfa83f61e4d27a87fcae1e025a"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
