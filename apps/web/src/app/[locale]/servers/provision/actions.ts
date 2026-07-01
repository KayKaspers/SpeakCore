'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import type { ManagedResourceResult } from '@speakcore/types';
import { getCurrentUser } from '@/lib/auth';
import { checkRateLimit, recordRateLimitHit, type RateLimitConfig } from '@/core/rate-limit';
import {
  buildProvisionInput,
  isOwner,
  prepareManagedTs3Resources,
  type WebPrepareStatus,
} from '@/core/provisioning';

export interface ProvisionActionState {
  status?: WebPrepareStatus;
  resources?: ManagedResourceResult[];
  serverId?: string;
  errorKey?: string;
}

const PREPARE_RATE_LIMIT: RateLimitConfig = { windowMs: 10 * 60 * 1000, max: 10 };

function toInt(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(n) ? n : fallback;
}

export async function prepareResourcesAction(
  _prev: ProvisionActionState,
  formData: FormData,
): Promise<ProvisionActionState> {
  const locale = String(formData.get('locale') ?? 'de');

  const user = await getCurrentUser();
  if (!isOwner(user)) {
    redirect(`/${locale}/login`);
  }

  const rlKey = `docker:prepare:${user!.id}`;
  if ((await checkRateLimit(rlKey, PREPARE_RATE_LIMIT)).limited) {
    return { errorKey: 'rateLimited' };
  }
  await recordRateLimitHit(rlKey);

  const input = buildProvisionInput({
    instanceId: randomUUID(),
    displayName: String(formData.get('displayName') ?? '').trim(),
    voicePort: toInt(formData.get('voicePort'), 9987),
    queryPort: toInt(formData.get('queryPort'), 10011),
    fileTransferPort: toInt(formData.get('fileTransferPort'), 30033),
    mode: String(formData.get('mode') ?? 'simple') === 'expert' ? 'expert' : 'simple',
  });

  const result = await prepareManagedTs3Resources(input, user!.email);
  return { status: result.status, resources: result.resources, serverId: result.serverId };
}
