-- AlterTable: managed provisioning state (NDF Step 014). Additive, nullable columns – bestehende
-- external Server (Step 008/009) bleiben unberührt.
ALTER TABLE "ServerInstance" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "provisioningStatus" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "managedNetworkName" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "managedVolumeName" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "managedContainerName" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "lastProvisioningStep" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "lastProvisioningErrorKey" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "resourcesPreparedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "ServerInstance_instanceId_key" ON "ServerInstance"("instanceId");
