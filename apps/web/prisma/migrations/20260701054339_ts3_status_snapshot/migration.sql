-- AlterTable
ALTER TABLE "ServerInstance" ADD COLUMN "lastStatus" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "lastStatusCheckedAt" DATETIME;
ALTER TABLE "ServerInstance" ADD COLUMN "statusClientsOnline" INTEGER;
ALTER TABLE "ServerInstance" ADD COLUMN "statusMaxClients" INTEGER;
ALTER TABLE "ServerInstance" ADD COLUMN "statusMessageKey" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "statusName" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "statusPlatform" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "statusUptimeSeconds" INTEGER;
ALTER TABLE "ServerInstance" ADD COLUMN "statusVersion" TEXT;
