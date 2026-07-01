-- NDF Step 019: Read-only Healthcheck-Ist-Zustand für managed Server (getrennt vom Lifecycle-Status).
ALTER TABLE "ServerInstance" ADD COLUMN "lastHealthCheckedAt" DATETIME;
ALTER TABLE "ServerInstance" ADD COLUMN "containerRuntimeStatus" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "ts3ReachabilityStatus" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "lastHealthErrorKey" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "lastSuccessfulHealthCheckAt" DATETIME;
