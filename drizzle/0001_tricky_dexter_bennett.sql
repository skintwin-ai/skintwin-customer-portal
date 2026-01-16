CREATE TABLE `accounting_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`system` enum('quickbooks','xero','gnucash') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`externalId` varchar(128),
	`action` enum('create','update','delete') NOT NULL,
	`status` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`syncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`organizationId` int,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`oldValues` json,
	`newValues` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`locationId` int,
	`customerId` int NOT NULL,
	`therapistId` int,
	`wixBookingId` varchar(128),
	`serviceType` varchar(128) NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`status` enum('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending',
	`scheduledAt` timestamp NOT NULL,
	`duration` int NOT NULL,
	`price` decimal(10,2),
	`notes` text,
	`customerNotes` text,
	`confirmationSent` boolean DEFAULT false,
	`reminderSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`therapistId` int NOT NULL,
	`organizationId` int NOT NULL,
	`orderId` int,
	`treatmentId` int,
	`type` enum('treatment','product_sale','referral') NOT NULL,
	`baseAmount` decimal(10,2) NOT NULL,
	`commissionRate` decimal(5,2) NOT NULL,
	`commissionAmount` decimal(10,2) NOT NULL,
	`status` enum('pending','approved','paid','cancelled') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`paymentReference` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`therapistId` int NOT NULL,
	`organizationId` int NOT NULL,
	`locationId` int,
	`type` enum('initial','follow_up','treatment','review') NOT NULL,
	`status` enum('scheduled','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
	`scheduledAt` timestamp,
	`completedAt` timestamp,
	`duration` int,
	`skinAnalysis` json,
	`recommendations` json,
	`notes` text,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_therapist_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`therapistId` int NOT NULL,
	`organizationId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	`isPrimary` boolean NOT NULL DEFAULT true,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `customer_therapist_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`integration` enum('shopify','wix','stripe','paystack','quickbooks','xero','erpnext','workos') NOT NULL,
	`credentials` text NOT NULL,
	`expiresAt` timestamp,
	`refreshToken` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`city` varchar(128),
	`state` varchar(128),
	`country` varchar(64),
	`postalCode` varchar(32),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`serviceRadius` int,
	`phone` varchar(32),
	`email` varchar(320),
	`posType` enum('shopify','opencart','none') DEFAULT 'none',
	`posStoreId` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int,
	`type` enum('commission_earned','booking_confirmed','payment_received','order_update','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`data` json,
	`isRead` boolean NOT NULL DEFAULT false,
	`emailSent` boolean DEFAULT false,
	`emailSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`treatmentId` int,
	`name` varchar(255) NOT NULL,
	`sku` varchar(128),
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`type` enum('product','treatment','service') NOT NULL DEFAULT 'product',
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`therapistId` int,
	`locationId` int,
	`shopifyOrderId` varchar(64),
	`opencartOrderId` varchar(64),
	`orderNumber` varchar(64) NOT NULL,
	`status` enum('pending','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`subtotal` decimal(10,2) NOT NULL,
	`tax` decimal(10,2) DEFAULT '0.00',
	`discount` decimal(10,2) DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`paymentMethod` enum('stripe','paystack','cash','card','other'),
	`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`shippingAddress` json,
	`billingAddress` json,
	`notes` text,
	`source` enum('web','pos_shopify','pos_opencart','manual') NOT NULL DEFAULT 'web',
	`syncedToAccounting` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('salon','retail','distributor') NOT NULL,
	`ownerId` int NOT NULL,
	`shopifyStoreUrl` varchar(512),
	`shopifyAccessToken` text,
	`wixSiteId` varchar(128),
	`wixAccessToken` text,
	`stripeAccountId` varchar(128),
	`paystackSubaccountCode` varchar(128),
	`quickbooksRealmId` varchar(64),
	`xeroTenantId` varchar(64),
	`erpnextUrl` varchar(512),
	`erpnextApiKey` text,
	`settings` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`orderId` int,
	`customerId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`processor` enum('stripe','paystack') NOT NULL,
	`processorPaymentId` varchar(128),
	`processorChargeId` varchar(128),
	`status` enum('pending','succeeded','failed','refunded','partially_refunded') NOT NULL DEFAULT 'pending',
	`refundedAmount` decimal(10,2) DEFAULT '0.00',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`shopifyProductId` varchar(64),
	`opencartProductId` varchar(64),
	`erpnextItemCode` varchar(64),
	`sku` varchar(128),
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`costPrice` decimal(10,2),
	`category` varchar(128),
	`imageUrl` text,
	`inventory` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`syncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int,
	`erpnextItemCode` varchar(64),
	`name` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`receivedQuantity` int DEFAULT 0,
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`erpnextPOId` varchar(64),
	`poNumber` varchar(64) NOT NULL,
	`supplierId` int,
	`supplierName` varchar(255),
	`status` enum('draft','submitted','approved','received','cancelled') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(10,2) NOT NULL,
	`tax` decimal(10,2) DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`expectedDelivery` timestamp,
	`receivedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('commission','sales','procurement','inventory','customer_analytics') NOT NULL,
	`title` varchar(255) NOT NULL,
	`period` varchar(32),
	`generatedBy` int,
	`fileUrl` text,
	`fileKey` varchar(255),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`erpnextSupplierId` varchar(64),
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`email` varchar(320),
	`phone` varchar(32),
	`address` text,
	`paymentTerms` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `therapists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`locationId` int,
	`specializations` json,
	`certifications` json,
	`commissionRate` decimal(5,2) NOT NULL DEFAULT '10.00',
	`salesCommissionRate` decimal(5,2) NOT NULL DEFAULT '5.00',
	`bio` text,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `therapists_id` PRIMARY KEY(`id`),
	CONSTRAINT `therapists_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `treatments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultationId` int,
	`customerId` int NOT NULL,
	`therapistId` int NOT NULL,
	`organizationId` int NOT NULL,
	`locationId` int,
	`serviceName` varchar(255) NOT NULL,
	`serviceCode` varchar(64),
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`duration` int,
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`scheduledAt` timestamp,
	`completedAt` timestamp,
	`notes` text,
	`productsUsed` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `treatments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('retail_customer','therapist','salon_owner','admin') NOT NULL DEFAULT 'retail_customer';--> statement-breakpoint
ALTER TABLE `users` ADD `workosUserId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;