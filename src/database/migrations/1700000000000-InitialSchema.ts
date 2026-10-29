import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Roles and status enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_role_enum" AS ENUM('MERCHANT_ADMIN', 'STORE_MANAGER', 'CASHIER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sales_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_status_enum" AS ENUM('SUCCESS', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // merchants
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchants_id" PRIMARY KEY ("id")
      );
    `);

    // stores
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "address" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stores_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stores_merchant_id" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stores_merchant_id" ON "stores" ("merchant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stores_merchant_name" ON "stores" ("merchant_id", "name");`,
    );

    // users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "store_id" uuid,
        "email" character varying(150) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "name" character varying(100) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'CASHIER',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_merchant_id" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_users_store_id" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_merchant_id" ON "users" ("merchant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_store_id" ON "users" ("store_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_merchant_store" ON "users" ("merchant_id", "store_id");`,
    );

    // products
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "sku" character varying(64) NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "price" numeric(12,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_products_merchant_sku" UNIQUE ("merchant_id", "sku"),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_merchant_id" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_products_merchant_id" ON "products" ("merchant_id");`,
    );

    // inventories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "store_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "low_stock_threshold" integer NOT NULL DEFAULT 5,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inventories_store_product" UNIQUE ("store_id", "product_id"),
        CONSTRAINT "CHK_inventories_quantity_non_negative" CHECK ("quantity" >= 0),
        CONSTRAINT "PK_inventories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventories_store_id" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventories_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventories_store_id" ON "inventories" ("store_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventories_product_id" ON "inventories" ("product_id");`,
    );

    // sales
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "idempotency_key" character varying(128),
        "status" "sales_status_enum" NOT NULL DEFAULT 'PENDING',
        "total_amount" numeric(12,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sales_merchant_id" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sales_store_id" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sales_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sales_merchant_id" ON "sales" ("merchant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sales_store_id" ON "sales" ("store_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sales_user_id" ON "sales" ("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sales_idempotency_key" ON "sales" ("idempotency_key");`,
    );

    // sale_items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sale_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "quantity" integer NOT NULL,
        "subtotal" numeric(12,2) NOT NULL,
        CONSTRAINT "PK_sale_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sale_items_sale_id" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sale_items_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sale_items_sale_id" ON "sale_items" ("sale_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sale_items_product_id" ON "sale_items" ("product_id");`,
    );

    // payments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sale_id" uuid NOT NULL,
        "provider" character varying(50) NOT NULL DEFAULT 'MOCK',
        "amount" numeric(12,2) NOT NULL,
        "status" "payments_status_enum" NOT NULL,
        "transaction_id" character varying(100),
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_sale_id" UNIQUE ("sale_id"),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_sale_id" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE
      );
    `);

    // idempotency_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_records" (
        "key" character varying(128) NOT NULL,
        "store_id" uuid NOT NULL,
        "status_code" integer NOT NULL,
        "response_body" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_idempotency_records_key" PRIMARY KEY ("key")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_idempotency_store_key" ON "idempotency_records" ("store_id", "key");`,
    );
  }

  public async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_records";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stores";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchants";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sales_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum";`);
  }
}
