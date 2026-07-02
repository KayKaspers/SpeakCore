-- NDF Step 025: Marker für entferntes managed Datenvolume (null = vorhanden/unbekannt | 'removed').
ALTER TABLE "ServerInstance" ADD COLUMN "managedVolumeState" TEXT;
