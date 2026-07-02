-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('API', 'SCRAPE_STATIC', 'SCRAPE_BROWSER');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ScrapeTrigger" AS ENUM ('CRON', 'MANUAL');

-- CreateEnum
CREATE TYPE "EmailDraftStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "defaultLowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailChain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "dataSourceType" "DataSourceType" NOT NULL,
    "connectionConfig" JSONB NOT NULL DEFAULT '{}',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "retailChainId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "chainMeta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ean" TEXT,
    "internalCode" TEXT,
    "unitPrice" DECIMAL(12,2),
    "currencyCode" TEXT,
    "marginRate" DECIMAL(5,4),
    "avgWeeklyVelocity" DECIMAL(10,2),
    "lowStockThreshold" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuChainMapping" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "retailChainId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "productUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkuChainMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReading" (
    "id" BIGSERIAL NOT NULL,
    "skuId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER,
    "stockStatus" "StockStatus" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scrapeRunId" TEXT,

    CONSTRAINT "StockReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationChainLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "retailChainId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationChainLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "retailChainId" TEXT NOT NULL,
    "organisationId" TEXT,
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "ScrapeTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "readingsCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "EmailDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDraftSku" (
    "id" TEXT NOT NULL,
    "emailDraftId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantityAtDraft" INTEGER,
    "stockStatusAtDraft" "StockStatus",

    CONSTRAINT "EmailDraftSku_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organisationId_idx" ON "User"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailChain_slug_key" ON "RetailChain"("slug");

-- CreateIndex
CREATE INDEX "Store_retailChainId_idx" ON "Store"("retailChainId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_retailChainId_externalId_key" ON "Store"("retailChainId", "externalId");

-- CreateIndex
CREATE INDEX "Sku_organisationId_idx" ON "Sku"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_organisationId_ean_key" ON "Sku"("organisationId", "ean");

-- CreateIndex
CREATE INDEX "SkuChainMapping_retailChainId_externalProductId_idx" ON "SkuChainMapping"("retailChainId", "externalProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SkuChainMapping_skuId_retailChainId_key" ON "SkuChainMapping"("skuId", "retailChainId");

-- CreateIndex
CREATE INDEX "StockReading_skuId_storeId_recordedAt_idx" ON "StockReading"("skuId", "storeId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "StockReading_storeId_recordedAt_idx" ON "StockReading"("storeId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "StockReading_scrapeRunId_idx" ON "StockReading"("scrapeRunId");

-- CreateIndex
CREATE INDEX "OrganisationChainLink_retailChainId_isActive_idx" ON "OrganisationChainLink"("retailChainId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationChainLink_organisationId_retailChainId_key" ON "OrganisationChainLink"("organisationId", "retailChainId");

-- CreateIndex
CREATE INDEX "ScrapeRun_retailChainId_createdAt_idx" ON "ScrapeRun"("retailChainId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScrapeRun_organisationId_idx" ON "ScrapeRun"("organisationId");

-- CreateIndex
CREATE INDEX "EmailDraft_organisationId_status_idx" ON "EmailDraft"("organisationId", "status");

-- CreateIndex
CREATE INDEX "EmailDraft_storeId_idx" ON "EmailDraft"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDraftSku_emailDraftId_skuId_key" ON "EmailDraftSku"("emailDraftId", "skuId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_retailChainId_fkey" FOREIGN KEY ("retailChainId") REFERENCES "RetailChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkuChainMapping" ADD CONSTRAINT "SkuChainMapping_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkuChainMapping" ADD CONSTRAINT "SkuChainMapping_retailChainId_fkey" FOREIGN KEY ("retailChainId") REFERENCES "RetailChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReading" ADD CONSTRAINT "StockReading_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReading" ADD CONSTRAINT "StockReading_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReading" ADD CONSTRAINT "StockReading_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "ScrapeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationChainLink" ADD CONSTRAINT "OrganisationChainLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationChainLink" ADD CONSTRAINT "OrganisationChainLink_retailChainId_fkey" FOREIGN KEY ("retailChainId") REFERENCES "RetailChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_retailChainId_fkey" FOREIGN KEY ("retailChainId") REFERENCES "RetailChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraftSku" ADD CONSTRAINT "EmailDraftSku_emailDraftId_fkey" FOREIGN KEY ("emailDraftId") REFERENCES "EmailDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraftSku" ADD CONSTRAINT "EmailDraftSku_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;
