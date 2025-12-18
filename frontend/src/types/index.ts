export interface Module {
  id: number;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  module_type: 'monitor' | 'script' | 'log_view' | 'data_sync' | 'service_control' | 'custom';
  route_path: string;
  component_path?: string;
  order: number;
  is_active: boolean;
  config?: string;
  created_at: string;
  updated_at: string;
}

export interface Script {
  id: number;
  name: string;
  title: string;
  description?: string;
  language: 'python' | 'bash' | 'shell' | 'powershell';
  script_path?: string;
  script_content?: string;
  parameters?: string;
  is_active: boolean;
  is_dangerous: boolean;
  timeout: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ExecutionLog {
  id: number;
  script_id: number;
  script_name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
  parameters?: string;
  output?: string;
  error?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  executed_by?: string;
  created_at: string;
}

export interface InstanceMetric {
  instance: string;
  node_name?: string | null;
  group?: string | null;
  memory_bytes: number;
  cpu_cores: number;
  configured_memory_bytes?: number | null;
  uptime_seconds?: number | null;
  up: boolean;
}

export interface ServiceMetric {
  service: string;
  memory_bytes: number;
  cpu_cores: number;
  node_count: number;
  configured_memory_per_instance_bytes?: number | null;
  configured_memory_total_bytes?: number | null;
  uptime_seconds?: number | null;
  health: 'up' | 'down';
  groups: string[];
  tags: string[];
  instances: InstanceMetric[];
}

export interface NodeHealthRequest {
  host?: string;
  port?: number;
  token?: string;
  namespace: string;
  node_ip: string;
}

export interface NodeInstanceSummary {
  service: string;
  exists: boolean;
  instance: NodeInstance | null;
  instances?: NodeInstance[];
}

export interface NodeInstance {
  id: string;
  host: string;
  port: number;
  healthy: boolean;
  isolate: boolean;
  protocol: string;
  version: string;
  weight?: number;
}

export interface NodeHealthResponse {
  node_ip: string;
  namespace: string;
  summary: {
    total_services: number;
    services_with_instance: number;
    services_without_instance: number;
    healthy_instances: number;
    unhealthy_instances: number;
    isolated_instances: number;
  };
  unhealthy_services: {
    service: string;
    host: string;
    port: number;
    namespace: string;
    isolated: boolean;
  }[];
  restart_commands: string[];
  services: NodeInstanceSummary[];
}

export interface NamespaceSummaryResponse {
  namespace: string;
  expected_hosts: string[];
  service_filter?: string | null;
  counts: {
    services: number;
    instances: number;
    illegal_instances: number;
    healthy_instances: number;
    unhealthy_instances: number;
  };
  services: NamespaceServiceSummary[];
}

export interface NamespaceServiceSummary {
  service: string;
  instances: NodeInstance[];
  groups: {
    expected: InstanceHostSummary[];
    unexpected: InstanceHostSummary[];
  };
  has_expected: boolean;
}

export interface InstanceHostSummary {
  host: string;
  port: number;
  healthy: boolean;
  isolate: boolean;
  source?: 'polaris' | 'allowed' | 'target' | 'unexpected';
  agent_managed?: boolean;
}

export type ServiceActionType = 'start' | 'stop' | 'restart' | 'status';

export interface ServiceActionPayload {
  hostname: string;
  service: string;
  action: ServiceActionType;
}

export interface ServiceActionResponse {
  success: boolean;
  result: {
    host: string;
    unit: string;
    action: string;
    output: string;
  };
}

export interface ServiceLogRequest {
  hostname: string;
  service: string;
  lines?: number;
  since?: string | null;
}

export interface ServiceLogResponse {
  success: boolean;
  result: {
    host: string;
    unit: string;
    lines: number;
    since?: string | null;
    output: string;
  };
}

export interface AgentStatusRequest {
  hosts: string[];
}

export interface AgentStatusResponse {
  success: boolean;
  results: {
    host: string;
    reachable: boolean;
    message: string;
  }[];
}

export interface FlowNodeCapacity {
  entity_key: string;
  entity_type: string;
  display_name?: string | null;
  team?: string | null;
  concurrency_limit?: number | null;
  warning_threshold?: number | null;
  metadata?: Record<string, unknown> | null;
  bottleneck?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface FlowNodeCapacityUpdateRequest {
  entity_type: string;
  display_name?: string | null;
  team?: string | null;
  concurrency_limit?: number | null;
  warning_threshold?: number | null;
  metadata?: Record<string, unknown> | null;
  bottleneck?: boolean | null;
}

export interface FlowNodeStats {
  instances?: number | null;
  healthy?: number | null;
  unhealthy?: number | null;
}

export interface FlowTopologyNode {
  id: string;
  name: string;
  icon?: string | null;
  info?: string | null;
  type: string;
  team?: string | null;
  tags: string[];
  concurrency?: number | null;
  weight?: number | null;
  bottleneck?: boolean;
  editable?: boolean;
  stats?: FlowNodeStats | null;
  capacity?: FlowNodeCapacity | null;
  metadata?: Record<string, unknown> | null;
}

export interface FlowTopologyLayer {
  id: string;
  name: string;
  type: string;
  nodes: FlowTopologyNode[];
}

export interface FlowTopologyAnalysisItem {
  node_id: string;
  name: string;
  type: string;
  reason: string;
  concurrency?: number | null;
}

export interface FlowTopologyAnalysis {
  bottlenecks: FlowTopologyAnalysisItem[];
  total_nodes: number;
  high_risk_nodes: number;
}

export interface FlowTopologyOverviewResponse {
  generated_at: string;
  layers: FlowTopologyLayer[];
  analysis: FlowTopologyAnalysis;
  inventory?: Record<string, FlowTopologyNode[]>;
}

export interface DomainCheckResponse {
  url: string;
  reachable: boolean;
  status_code?: number | null;
  cert_valid?: boolean | null;
  cert_expires_at?: string | null;
  days_remaining?: number | null;
  error?: string | null;
}

export type ServiceEnvironmentState = 'healthy' | 'warning' | 'danger' | 'missing' | 'unknown' | 'no_expected';

export interface ServicePanoramaEnvironmentMeta {
  key: string;
  label: string;
  namespace: string;
  description?: string | null;
  order: number;
  operations_allowed: boolean;
  color?: string | null;
  allowed_hosts: string[];
  agent_hosts: string[];
}

export interface ServicePanoramaEnvironmentStatus {
  key: string;
  label: string;
  namespace: string;
  description?: string | null;
  status: ServiceEnvironmentState;
  status_text: string;
  allowed_hosts: string[];
  allow_node_actions: boolean;
  allow_polaris_actions: boolean;
  read_only: boolean;
  operations_disabled_reason?: string | null;
  systemd_unit?: string | null;
  polaris_service: string;
  counts: {
    expected: number;
    unexpected: number;
    healthy: number;
    unhealthy: number;
  };
  instances: {
    expected: InstanceHostSummary[];
    unexpected: InstanceHostSummary[];
  };
  deployment_targets: {
    host: string;
    systemd_unit?: string | null;
    namespace?: string | null;
    port?: number | null;
  }[];
  error?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface ServicePanoramaItem {
  id: number;
  service_name: string;
  display_name: string;
  service_type: string;
  port?: number | null;
  team?: string | null;
  maintainers?: string | null;
  call_level?: number | null;
  description?: string | null;
  owner?: string | null;
  tags: string[];
  systemd_unit?: string | null;
  order: number;
  gitlab_project_id?: number | null;
  gitlab_repo?: string | null;
  jenkins_job?: string | null;
  environments: Record<string, ServicePanoramaEnvironmentStatus>;
}

export interface GitLabRef {
  name: string;
  commit?: string | null;
  updated_at?: string | null;
  protected?: boolean;
}

export interface JenkinsBuild {
  number?: number | null;
  result?: string | null;
  timestamp?: number | null;
  duration?: number | null;
  url?: string | null;
  branch?: string | null;
  environment?: string | null;
  ref_type?: string | null;
  hosts?: string[];
}

export interface JenkinsParameter {
  name: string;
  value?: string | null;
}

export interface JenkinsBuildStage {
  name?: string | null;
  status?: string | null;
  durationMillis?: number | null;
  pauseDurationMillis?: number | null;
  startTimeMillis?: number | null;
}

export interface JenkinsBuildDetail {
  number?: number | null;
  result?: string | null;
  building?: boolean;
  duration?: number | null;
  timestamp?: number | null;
  url?: string | null;
  parameters?: JenkinsParameter[];
  stages?: JenkinsBuildStage[];
}

export interface JenkinsBuildLogChunk {
  text: string;
  size: number;
  more: boolean;
  next_start: number;
}

export interface ServiceAllowedHostEntry {
  environment: string;
  hosts: string[];
}

export interface ServiceAllowedHostResponse {
  service_id: number;
  entries: ServiceAllowedHostEntry[];
}

export interface ServicePanoramaOverviewResponse {
  environments: ServicePanoramaEnvironmentMeta[];
  services: ServicePanoramaItem[];
}

export interface AgentHostEnvironment {
  environment: string;
  label: string;
  namespace: string;
  description?: string | null;
  operations_allowed: boolean;
  color?: string | null;
  hosts: string[];
  default_hosts: string[];
}

export interface AgentHostResponse {
  environments: AgentHostEnvironment[];
}

export interface IntegrationProfileOption {
  key: string;
  label: string;
  description?: string | null;
}

export interface EnvironmentIntegrationState {
  environment: string;
  label: string;
  namespace: string;
  polaris_profile: string;
  jenkins_profile: string;
}

export interface EnvironmentIntegrationResponse {
  environments: EnvironmentIntegrationState[];
  polaris_profiles: IntegrationProfileOption[];
  jenkins_profiles: IntegrationProfileOption[];
}
