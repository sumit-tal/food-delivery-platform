import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial migration to create all database tables
 */
export class CreateInitialTables1695234567890 implements MigrationInterface {
  name = 'CreateInitialTables1695234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create restaurants table
    await queryRunner.query(`
      CREATE TABLE "restaurants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "cuisineTypes" text NOT NULL,
        "city" character varying(100) NOT NULL,
        "area" character varying(100),
        "isOpen" boolean NOT NULL DEFAULT false,
        "rating" numeric(3,2),
        "etaMin" integer,
        "etaMax" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_restaurants_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_restaurants" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for restaurants table
    await queryRunner.query(`CREATE INDEX "IDX_restaurants_slug" ON "restaurants" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_restaurants_city" ON "restaurants" ("city")`);
    await queryRunner.query(`CREATE INDEX "IDX_restaurants_isOpen" ON "restaurants" ("isOpen")`);

    // Create menu_categories table
    await queryRunner.query(`
      CREATE TABLE "menu_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" character varying(500),
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "restaurantId" uuid,
        CONSTRAINT "PK_menu_categories" PRIMARY KEY ("id")
      )
    `);

    // Create menus table
    await queryRunner.query(`
      CREATE TABLE "menus" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" character varying(500),
        "isActive" boolean NOT NULL DEFAULT true,
        "availableFrom" TIME,
        "availableTo" TIME,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "restaurantId" uuid,
        CONSTRAINT "PK_menus" PRIMARY KEY ("id")
      )
    `);

    // Create menu_items table
    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" character varying(500),
        "price" numeric(10,2) NOT NULL,
        "discountedPrice" numeric(10,2),
        "imageUrl" character varying(500),
        "isVegetarian" boolean NOT NULL DEFAULT false,
        "isVegan" boolean NOT NULL DEFAULT false,
        "isGlutenFree" boolean NOT NULL DEFAULT false,
        "calories" integer,
        "preparationTime" integer,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "restaurantId" uuid,
        "menuId" uuid,
        "categoryId" uuid,
        CONSTRAINT "PK_menu_items" PRIMARY KEY ("id")
      )
    `);

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "restaurantId" uuid NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "totalAmount" numeric(10,2) NOT NULL,
        "deliveryAddress" jsonb NOT NULL,
        "deliveryFee" numeric(10,2) NOT NULL DEFAULT 0,
        "tax" numeric(10,2) NOT NULL DEFAULT 0,
        "discount" numeric(10,2) NOT NULL DEFAULT 0,
        "estimatedDeliveryTime" TIMESTAMP,
        "actualDeliveryTime" TIMESTAMP,
        "driverId" uuid,
        "specialInstructions" text,
        "paymentMethod" character varying(50) NOT NULL,
        "paymentStatus" character varying(50) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "idempotencyKey" character varying(255),
        CONSTRAINT "UQ_orders_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for orders table
    await queryRunner.query(`CREATE INDEX "IDX_orders_userId" ON "orders" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_restaurantId" ON "orders" ("restaurantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_status" ON "orders" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_paymentStatus" ON "orders" ("paymentStatus")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_createdAt" ON "orders" ("createdAt")`);

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "menuItemId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "quantity" integer NOT NULL,
        "specialInstructions" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id")
      )
    `);

    // Create index for order_items table
    await queryRunner.query(`CREATE INDEX "IDX_order_items_orderId" ON "order_items" ("orderId")`);

    // Create order_transactions table
    await queryRunner.query(`
      CREATE TABLE "order_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "status" character varying(50) NOT NULL,
        "provider" character varying(50) NOT NULL,
        "providerTransactionId" character varying(255),
        "paymentMethod" character varying(50) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_transactions" PRIMARY KEY ("id")
      )
    `);

    // Create index for order_transactions table
    await queryRunner.query(`CREATE INDEX "IDX_order_transactions_orderId" ON "order_transactions" ("orderId")`);

    // Create order_history table
    await queryRunner.query(`
      CREATE TABLE "order_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "status" character varying(50) NOT NULL,
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_history" PRIMARY KEY ("id")
      )
    `);

    // Create index for order_history table
    await queryRunner.query(`CREATE INDEX "IDX_order_history_orderId" ON "order_history" ("orderId")`);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "method" character varying(50) NOT NULL,
        "status" character varying(50) NOT NULL,
        "gatewayResponse" jsonb,
        "transactionId" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);

    // Create index for payments table
    await queryRunner.query(`CREATE INDEX "IDX_payments_orderId" ON "payments" ("orderId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON "payments" ("status")`);

    // Create payment_failure_queue table
    await queryRunner.query(`
      CREATE TABLE "payment_failure_queue" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paymentId" uuid NOT NULL,
        "retryCount" integer NOT NULL DEFAULT 0,
        "nextRetryAt" TIMESTAMP NOT NULL,
        "errorMessage" text,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_failure_queue" PRIMARY KEY ("id")
      )
    `);

    // Create index for payment_failure_queue table
    await queryRunner.query(`CREATE INDEX "IDX_payment_failure_queue_paymentId" ON "payment_failure_queue" ("paymentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_failure_queue_nextRetryAt" ON "payment_failure_queue" ("nextRetryAt")`);

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" character varying(50) NOT NULL,
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // Create index for notifications table
    await queryRunner.query(`CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_isRead" ON "notifications" ("isRead")`);

    // Create notification_templates table
    await queryRunner.query(`
      CREATE TABLE "notification_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying(50) NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_notification_templates_type" UNIQUE ("type"),
        CONSTRAINT "PK_notification_templates" PRIMARY KEY ("id")
      )
    `);

    // Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" character varying(50) NOT NULL,
        "email" boolean NOT NULL DEFAULT true,
        "push" boolean NOT NULL DEFAULT true,
        "sms" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_notification_preferences_userId_type" UNIQUE ("userId", "type"),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id")
      )
    `);

    // Create index for notification_preferences table
    await queryRunner.query(`CREATE INDEX "IDX_notification_preferences_userId" ON "notification_preferences" ("userId")`);

    // Add foreign key constraints
    await queryRunner.query(`ALTER TABLE "menu_categories" ADD CONSTRAINT "FK_menu_categories_restaurantId" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "menus" ADD CONSTRAINT "FK_menus_restaurantId" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD CONSTRAINT "FK_menu_items_restaurantId" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD CONSTRAINT "FK_menu_items_menuId" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD CONSTRAINT "FK_menu_items_categoryId" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_transactions" ADD CONSTRAINT "FK_order_transactions_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_history" ADD CONSTRAINT "FK_order_history_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payment_failure_queue" ADD CONSTRAINT "FK_payment_failure_queue_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(`ALTER TABLE "payment_failure_queue" DROP CONSTRAINT "FK_payment_failure_queue_paymentId"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_orderId"`);
    await queryRunner.query(`ALTER TABLE "order_history" DROP CONSTRAINT "FK_order_history_orderId"`);
    await queryRunner.query(`ALTER TABLE "order_transactions" DROP CONSTRAINT "FK_order_transactions_orderId"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_orderId"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP CONSTRAINT "FK_menu_items_categoryId"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP CONSTRAINT "FK_menu_items_menuId"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP CONSTRAINT "FK_menu_items_restaurantId"`);
    await queryRunner.query(`ALTER TABLE "menus" DROP CONSTRAINT "FK_menus_restaurantId"`);
    await queryRunner.query(`ALTER TABLE "menu_categories" DROP CONSTRAINT "FK_menu_categories_restaurantId"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notification_templates"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "payment_failure_queue"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "order_history"`);
    await queryRunner.query(`DROP TABLE "order_transactions"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "menu_items"`);
    await queryRunner.query(`DROP TABLE "menus"`);
    await queryRunner.query(`DROP TABLE "menu_categories"`);
    await queryRunner.query(`DROP TABLE "restaurants"`);
  }
}
