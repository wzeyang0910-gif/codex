-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'sales');

-- CreateEnum
CREATE TYPE "LeadTaskStatus" AS ENUM ('queued', 'running', 'partial', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "LeadGrade" AS ENUM ('A', 'B', 'C', 'rejected');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('valid', 'accept_all', 'risky', 'invalid', 'unknown');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('not_contacted', 'sent', 'replied', 'quoted', 'won', 'not_interested');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "zhName" TEXT NOT NULL,
    "enName" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "keywords" TEXT[],
    "scenarios" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LeadTaskStatus" NOT NULL DEFAULT 'queued',
    "targetRegion" TEXT NOT NULL,
    "targetCountries" TEXT[],
    "productKeys" TEXT[],
    "customerTypes" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'English',
    "extraKeywords" TEXT[],
    "targetCount" INTEGER NOT NULL DEFAULT 5,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "searchedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT,
    "website" TEXT,
    "domain" TEXT,
    "brandNames" TEXT[],
    "customerType" TEXT NOT NULL,
    "businessSummary" TEXT NOT NULL,
    "demandEvidence" TEXT NOT NULL,
    "recommendedProducts" TEXT[],
    "grade" "LeadGrade" NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'not_contacted',
    "notes" TEXT NOT NULL DEFAULT '',
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBrand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailStatus" "EmailStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "riskNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLetter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "companyId" TEXT,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_key_key" ON "Product"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Company_normalizedName_country_region_key" ON "Company"("normalizedName", "country", "region");

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_country_region_key" ON "Company"("domain", "country", "region");

-- CreateIndex
CREATE INDEX "CompanyBrand_companyId_idx" ON "CompanyBrand"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBrand_normalizedName_country_region_key" ON "CompanyBrand"("normalizedName", "country", "region");

-- CreateIndex
CREATE INDEX "ApiCallLog_userId_createdAt_idx" ON "ApiCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_taskId_createdAt_idx" ON "ApiCallLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_companyId_createdAt_idx" ON "ApiCallLog"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadTask" ADD CONSTRAINT "LeadTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LeadTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBrand" ADD CONSTRAINT "CompanyBrand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLetter" ADD CONSTRAINT "OutreachLetter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LeadTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
