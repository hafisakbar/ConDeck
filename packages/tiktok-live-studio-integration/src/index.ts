export {
  candidatePorts,
  discoverLiveStudio,
  parseDiscoveryOutput,
  type DiscoverOptions,
  type PowerShellRunner,
  type StudioProcess,
  type StudioRuntime,
} from './discovery';
export {
  actionResultSchema,
  checkVersion,
  decodeJsonPayload,
  normalizeState,
  parseVersion,
  rawTikTokSettingsSchema,
  type VersionCompatibility,
} from './protocol';
export {
  createLiveStudioSocket,
  type LiveStudioSocket,
  type LiveStudioSocketFactory,
  type LiveStudioSocketOptions,
} from './socket';
export {
  createTikTokClient,
  type TikTokClient,
  type TikTokClientOptions,
  type TikTokClientStatus,
} from './client';
