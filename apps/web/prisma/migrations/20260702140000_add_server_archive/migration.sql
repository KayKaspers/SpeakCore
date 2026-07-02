-- NDF Step 027: Managed ServerRecord archivieren (statt hart löschen) + Credential-Entscheidung.
ALTER TABLE "ServerInstance" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "ServerInstance" ADD COLUMN "archiveReasonKey" TEXT;
ALTER TABLE "ServerInstance" ADD COLUMN "credentialsRemovedAt" DATETIME;
