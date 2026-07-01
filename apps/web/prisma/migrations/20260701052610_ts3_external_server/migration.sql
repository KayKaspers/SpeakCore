-- CreateTable
CREATE TABLE "ServerCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverInstanceId" TEXT NOT NULL,
    "encryptedUsername" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServerCredential_serverInstanceId_fkey" FOREIGN KEY ("serverInstanceId") REFERENCES "ServerInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ServerInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'teamspeak3',
    "mode" TEXT NOT NULL DEFAULT 'external',
    "host" TEXT,
    "queryPort" INTEGER,
    "voicePort" INTEGER,
    "virtualServerId" INTEGER,
    "runState" TEXT NOT NULL DEFAULT 'unknown',
    "lastConnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ServerInstance" ("createdAt", "id", "name", "runState", "type", "updatedAt") SELECT "createdAt", "id", "name", "runState", "type", "updatedAt" FROM "ServerInstance";
DROP TABLE "ServerInstance";
ALTER TABLE "new_ServerInstance" RENAME TO "ServerInstance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ServerCredential_serverInstanceId_key" ON "ServerCredential"("serverInstanceId");
