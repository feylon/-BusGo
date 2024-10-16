import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationSchema1717200000000 implements MigrationInterface {
    name = 'NotificationSchema1717200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "processed_events" ("eventId" uuid NOT NULL, "handler" character varying(60) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b4d6bbd4bea3a359b9d99154deb" PRIMARY KEY ("eventId", "handler"))`);
        await queryRunner.query(`CREATE TABLE "notification_preferences" ("userId" uuid NOT NULL, "channels" jsonb NOT NULL DEFAULT '["IN_APP","PUSH"]', "muted" jsonb NOT NULL DEFAULT '[]', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b70c44e8b00757584a393225593" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying(40) NOT NULL, "title" jsonb NOT NULL, "body" jsonb NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "channels" jsonb NOT NULL DEFAULT '["IN_APP"]', "eventId" uuid, "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6e613a2a79d946d3a55484b5c1d" UNIQUE ("eventId", "userId"), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9d8adc796dff8c73acd1eba656" ON "notifications" ("readAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_21e65af2f4f242d4c85a92aff4" ON "notifications" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "notificationId" uuid NOT NULL, "channel" character varying(10) NOT NULL, "provider" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "error" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_81daeff81f237bd384f7cfc4a4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_480dc696b3c108f40b394d65fa" ON "notification_deliveries" ("notificationId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_480dc696b3c108f40b394d65fa"`);
        await queryRunner.query(`DROP TABLE "notification_deliveries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_21e65af2f4f242d4c85a92aff4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d8adc796dff8c73acd1eba656"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TABLE "notification_preferences"`);
        await queryRunner.query(`DROP TABLE "processed_events"`);
    }

}
