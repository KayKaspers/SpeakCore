/**
 * Read-only JSON-Export eines managed Servers (NDF Step 029). **OWNER-only, kein Docker/Agent.**
 * Liefert nicht-geheime Metadaten (+ optional Audit-Historie via `?audit=1`) als Datei-Download.
 * **Keine** Secrets/Credentials; keine Schreiboperation außer dem Export-Audit.
 */
import { getCurrentUser } from '@/lib/auth';
import { exportManagedServer } from '@/core/server-export';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
): Promise<Response> {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return new Response('unauthorized', { status: 401 });
  }

  const includeAudit = new URL(req.url).searchParams.get('audit') === '1';
  const result = await exportManagedServer(id, user.email, { includeAudit });

  if (result.status === 'notFound') return new Response('not found', { status: 404 });
  if (result.status === 'notManaged') return new Response('not a managed server', { status: 400 });
  if (result.status !== 'ok' || !result.export) return new Response('export failed', { status: 500 });

  const body = JSON.stringify(result.export, null, 2);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'no-store',
    },
  });
}
