/**
 * Web-proxied Backup-Download (NDF Step 037, ADR-0035). **OWNER-only.**
 *
 * POST-Form (Bestätigungen + getippt `DOWNLOAD BACKUP`) → Guards + Rate-Limit → **Verify direkt
 * vor Download** (nur `valid` streamt) → der serverseitige Agent-Stream wird **ohne
 * Komplett-Einlesen** an den Browser durchgereicht (Backpressure via Web-Streams). Der Browser
 * spricht den Agent **nie** direkt an; Agent-URL/Token bleiben serverseitig. Blockierte Anfragen
 * werden mit generischem Statuskey zurück zur Backup-Liste geleitet – keine Host-Pfade, keine
 * Roh-Agent-Fehler, keine Secrets.
 */
import { getCurrentUser } from '@/lib/auth';
import { downloadManagedVolumeBackupForServer } from '@/core/backup-download';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
): Promise<Response> {
  const { locale, id } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return new Response('unauthorized', { status: 401 });
  }

  let fileName = '';
  const confirmations = {
    confirmBackupContainsSensitiveData: false,
    confirmSecureStorageResponsibility: false,
    typedConfirmation: '',
  };
  try {
    const form = await req.formData();
    fileName = String(form.get('fileName') ?? '');
    confirmations.confirmBackupContainsSensitiveData =
      form.get('confirmBackupContainsSensitiveData') === 'on';
    confirmations.confirmSecureStorageResponsibility =
      form.get('confirmSecureStorageResponsibility') === 'on';
    confirmations.typedConfirmation = String(form.get('typedConfirmation') ?? '');
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const result = await downloadManagedVolumeBackupForServer(
    id,
    user.email,
    user.id,
    fileName,
    confirmations,
  );

  if (result.kind === 'blocked') {
    if (result.status === 'notFound') {
      return Response.redirect(new URL(`/${locale}/servers`, req.url), 303);
    }
    const back = new URL(`/${locale}/servers/${id}`, req.url);
    back.searchParams.set('backups', '1');
    back.searchParams.set('download', result.status);
    return Response.redirect(back, 303);
  }

  // Stream durchreichen – kein Buffering, keine temporäre Kopie im Web-Prozess.
  const headers = new Headers({
    'content-type': result.download.contentType,
    'content-disposition': `attachment; filename="${result.download.fileName}"`,
    'cache-control': 'no-store',
  });
  if (result.download.contentLength) {
    headers.set('content-length', result.download.contentLength);
  }
  return new Response(result.download.stream, { status: 200, headers });
}
