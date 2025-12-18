"""
Environment metadata definitions and helpers.
"""
from __future__ import annotations

from typing import Any, Dict, List

SERVICE_ENVIRONMENTS: List[Dict[str, Any]] = [
    {
        "key": "dev",
        "label": "开发环境",
        "description": "dev · 172.16.62.125",
        "namespace": "dev",
        "allowed_hosts": ["172.16.62.125"],
        "agent_hosts": ["172.16.62.125"],
        "operations_enabled": True,
        "color": "emerald",
        "order": 1,
        "default_integrations": {"polaris": "test", "jenkins": "test"},
    },
    {
        "key": "uat",
        "label": "UAT 环境",
        "description": "uat · 172.16.62.124",
        "namespace": "uat",
        "allowed_hosts": ["172.16.62.124"],
        "agent_hosts": ["172.16.62.124"],
        "operations_enabled": True,
        "color": "sky",
        "order": 2,
        "default_integrations": {"polaris": "test", "jenkins": "test"},
    },
    {
        "key": "test",
        "label": "测试环境",
        "description": "test · 172.16.62.123",
        "namespace": "test",
        "allowed_hosts": ["172.16.62.123"],
        "agent_hosts": ["172.16.62.123"],
        "operations_enabled": True,
        "color": "amber",
        "order": 3,
        "default_integrations": {"polaris": "test", "jenkins": "test"},
    },
    {
        "key": "prod",
        "label": "生产环境",
        "description": "prod · Polaris",
        "namespace": "test",  # 临时使用 test namespace 的数据
        "allowed_hosts": [],
        "agent_hosts": [],
        "operations_enabled": False,
        "color": "rose",
        "order": 4,
        "default_integrations": {"polaris": "test", "jenkins": "test"},  # 临时使用测试 Polaris
    },
]

ENVIRONMENT_KEY_MAP: Dict[str, Dict[str, Any]] = {env["key"]: env for env in SERVICE_ENVIRONMENTS}
NAMESPACE_ENV_KEY_MAP: Dict[str, str] = {
    env["namespace"]: env["key"]
    for env in SERVICE_ENVIRONMENTS
    if env.get("namespace")
}
DEFAULT_ENVIRONMENT_KEY: str = SERVICE_ENVIRONMENTS[0]["key"] if SERVICE_ENVIRONMENTS else "dev"


def get_environment_default_profiles(env_key: str) -> Dict[str, str]:
    env = ENVIRONMENT_KEY_MAP.get(env_key)
    if not env:
        return {}
    defaults = env.get("default_integrations")
    if isinstance(defaults, dict):
        return defaults
    return {}


def normalize_environment_key(value: str | None) -> str:
    if not value:
        return DEFAULT_ENVIRONMENT_KEY
    key = value.strip()
    if key in ENVIRONMENT_KEY_MAP:
        return key
    lowered = key.lower()
    if lowered in ENVIRONMENT_KEY_MAP:
        return lowered
    return DEFAULT_ENVIRONMENT_KEY


def resolve_environment_key_from_namespace(namespace: str | None) -> str:
    if not namespace:
        return DEFAULT_ENVIRONMENT_KEY
    return NAMESPACE_ENV_KEY_MAP.get(namespace, DEFAULT_ENVIRONMENT_KEY)
