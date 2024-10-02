import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentSchema1717500000000 implements MigrationInterface {
    name = 'PaymentSchema1717500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "userId" uuid NOT NULL, "amount" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'UZS', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "provider" character varying(20) NOT NULL, "transactionId" character varying(80), "checkoutUrl" character varying(255), "description" character varying(255), "failureReason" character varying(255), "expiresAt" TIMESTAMP WITH TIME ZONE, "paidAt" TIMESTAMP WITH TIME ZONE, "refundedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1ead3dc5d71db0ea822706e389" ON "payments" ("bookingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d35cb3c13a18e1ea1705b2817b" ON "payments" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_52620e40ade9b43dc2493ca05e" ON "payments" ("status", "expiresAt") `);
        await queryRunner.query(`CREATE TABLE "payment_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "paymentId" uuid NOT NULL, "fromStatus" character varying(20), "toStatus" character varying(20) NOT NULL, "note" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b5bda25324e539ea41bc09697f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a9ab9fe6961e125e5d9ddac99a" ON "payment_logs" ("paymentId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a9ab9fe6961e125e5d9ddac99a"`);
        await queryRunner.query(`DROP TABLE "payment_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52620e40ade9b43dc2493ca05e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d35cb3c13a18e1ea1705b2817b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ead3dc5d71db0ea822706e389"`);
        await queryRunner.query(`DROP TABLE "payments"`);
    }

}
