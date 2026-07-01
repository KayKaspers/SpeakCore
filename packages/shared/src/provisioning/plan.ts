/**
 * TS3-Provisioning-**Blueprint** (reine Planung, NDF Step 010).
 *
 * `createTs3ProvisioningPlan` **plant nur** – es wird NICHTS ausgeführt: kein Docker, kein Container,
 * kein Volume, kein Netzwerk, kein Socket. Ergebnis ist ein deklarativer Plan (Namen/Labels/Ports/
 * Volumes/Netzwerke/Secrets-Anforderungen/Warnungen/Rollback/Audit) für einen späteren Step.
 */
import type {
  PlannedAuditAction,
  PlannedPort,
  ProvisionWarning,
  RollbackStep,
  SecretRequirement,
  Ts3ProvisionInput,
  Ts3ProvisioningPlan,
} from '@speakcore/types';
import {
  LABEL_MANAGED,
  LABEL_PROJECT,
  LABEL_SERVICE,
  PROJECT_NAME,
  TS3_DATA_MOUNT_PATH,
  TS3_FILETRANSFER_CONTAINER_PORT,
  TS3_QUERY_CONTAINER_PORT,
  TS3_VOICE_CONTAINER_PORT,
  buildManagedLabels,
  containerName,
  defaultVolumeName,
  networkName,
} from './constants';

const SECRETS: SecretRequirement[] = [
  {
    key: 'TS3_SERVERQUERY_ADMIN_PASSWORD',
    generate: true,
    storage: 'encrypted-db',
    descriptionKey: 'provisioning.secrets.queryAdminPassword',
  },
];

const ROLLBACK: RollbackStep[] = [
  {
    onFailureOf: 'CREATE_TS3_CONTAINER',
    action: 'REMOVE_MANAGED_CONTAINER',
    volumePolicy: 'keep',
    noteKey: 'provisioning.rollback.containerCreateFailed',
  },
  {
    onFailureOf: 'START_MANAGED_CONTAINER',
    action: 'REMOVE_MANAGED_CONTAINER',
    volumePolicy: 'keep',
    noteKey: 'provisioning.rollback.healthCheckFailed',
  },
  {
    onFailureOf: 'ROLLBACK_TS3_PROVISION',
    action: 'REMOVE_MANAGED_CONTAINER',
    volumePolicy: 'remove',
    noteKey: 'provisioning.rollback.fullCleanup',
  },
];

const AUDIT: PlannedAuditAction[] = [
  { action: 'ts3.provision.planned', noteKey: 'provisioning.audit.planned' },
  { action: 'ts3.network.created', noteKey: 'provisioning.audit.networkCreated' },
  { action: 'ts3.volume.created', noteKey: 'provisioning.audit.volumeCreated' },
  { action: 'ts3.container.created', noteKey: 'provisioning.audit.containerCreated' },
  { action: 'ts3.container.started', noteKey: 'provisioning.audit.containerStarted' },
  { action: 'ts3.provision.completed', noteKey: 'provisioning.audit.completed' },
  { action: 'ts3.provision.rolledBack', noteKey: 'provisioning.audit.rolledBack' },
];

export function createTs3ProvisioningPlan(input: Ts3ProvisionInput): Ts3ProvisioningPlan {
  const labels = buildManagedLabels(input.instanceId, 'teamspeak3');
  const volumeName = input.dataVolumeName ?? defaultVolumeName(input.instanceId);

  const ports: PlannedPort[] = [
    { name: 'voice', hostPort: input.voicePort, containerPort: TS3_VOICE_CONTAINER_PORT, protocol: 'udp' },
    { name: 'query', hostPort: input.queryPort, containerPort: TS3_QUERY_CONTAINER_PORT, protocol: 'tcp' },
    {
      name: 'fileTransfer',
      hostPort: input.fileTransferPort,
      containerPort: TS3_FILETRANSFER_CONTAINER_PORT,
      protocol: 'tcp',
    },
  ];

  const networkLabels = {
    [LABEL_MANAGED]: 'true',
    [LABEL_PROJECT]: PROJECT_NAME,
    [LABEL_SERVICE]: 'voice-network',
  };

  const warnings: ProvisionWarning[] = [
    // Das offizielle TS3-Image gibt Initial-Credentials in den Container-Logs aus.
    { code: 'secretInLogsRisk' },
  ];

  return {
    instanceId: input.instanceId,
    labels,
    container: {
      name: containerName(input.instanceId),
      image: input.imageName,
      restartPolicy: input.restartPolicy,
      labels,
      ports,
      volumes: [{ volume: volumeName, mountPath: TS3_DATA_MOUNT_PATH }],
      networks: [networkName()],
      environment: { ...(input.environment ?? {}) },
      ...(input.resourceLimits ? { resourceLimits: input.resourceLimits } : {}),
    },
    volumes: [{ name: volumeName, mountPath: TS3_DATA_MOUNT_PATH, labels }],
    networks: [{ name: networkName(), labels: networkLabels }],
    ports,
    secrets: SECRETS,
    warnings,
    rollback: ROLLBACK,
    audit: AUDIT,
  };
}
