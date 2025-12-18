"""
Centralized application configuration helpers and integration profiles.
"""
from __future__ import annotations

from typing import Any, Dict, List

import os
from dotenv import load_dotenv

load_dotenv()


def _require_env(key: str, default: str | None = None) -> str:
    """Fetch environment variable or raise a helpful error."""
    value = os.getenv(key, default)
    if value is None or value == "":
        raise RuntimeError(f"环境变量 {key} 未配置，请在 backend/.env 中设置")
    return value


def _build_polaris_profiles() -> Dict[str, Dict[str, Any]]:
    profiles: Dict[str, Dict[str, Any]] = {}
    test_host = _require_env("POLARIS_TEST_HOST", "172.16.62.111")
    test_port = int(_require_env("POLARIS_TEST_PORT", "8090"))
    test_token = _require_env(
        "POLARIS_TEST_TOKEN",
        "nu/0WRA4EqSR1FagrjRj0fZwPXuGlMpX+zCuWu4uMqy8xr1vRjisSbA25aAC3mtU8MeeRsKhQiDAynUR09I=",
    )
    profiles["test"] = {
        "key": "test",
        "label": "测试北极星",
        "description": "dev/uat/test/阶段环境",
        "host": test_host,
        "port": test_port,
        "token": test_token,
    }
    prod_host = os.getenv("POLARIS_PROD_HOST")
    prod_token = os.getenv("POLARIS_PROD_TOKEN")
    if prod_host and prod_token:
        prod_port = int(os.getenv("POLARIS_PROD_PORT", str(test_port)))
        profiles["prod"] = {
            "key": "prod",
            "label": "生产北极星",
            "description": "生产环境专用",
            "host": prod_host,
            "port": prod_port,
            "token": prod_token,
        }
    return profiles


def _build_jenkins_profiles() -> Dict[str, Dict[str, Any]]:
    profiles: Dict[str, Dict[str, Any]] = {}
    test_url = os.getenv("JENKINS_TEST_URL", os.getenv("JENKINS_URL", "")).rstrip("/")
    test_webhook = os.getenv("JENKINS_TEST_WEBHOOK_URL", os.getenv("JENKINS_WEBHOOK_URL", "")).rstrip("/")
    test_user = os.getenv("JENKINS_TEST_USER", os.getenv("JENKINS_USER", ""))
    test_token = os.getenv("JENKINS_TEST_TOKEN", os.getenv("JENKINS_TOKEN", ""))
    if test_url:
        profiles["test"] = {
            "key": "test",
            "label": "测试 Jenkins",
            "description": "dev/uat/test/阶段环境",
            "url": test_url,
            "webhook_url": test_webhook,
            "user": test_user,
            "token": test_token,
        }
    prod_url = os.getenv("JENKINS_PROD_URL", "").rstrip("/")
    prod_webhook = os.getenv("JENKINS_PROD_WEBHOOK_URL", "").rstrip("/")
    prod_user = os.getenv("JENKINS_PROD_USER", "")
    prod_token = os.getenv("JENKINS_PROD_TOKEN", "")
    if prod_url:
        profiles["prod"] = {
            "key": "prod",
            "label": "生产 Jenkins",
            "description": "生产环境专用",
            "url": prod_url,
            "webhook_url": prod_webhook,
            "user": prod_user,
            "token": prod_token,
        }
    return profiles


# Tencent Cloud Configuration
TENCENT_CLOUD_SECRET_ID: str | None = os.getenv("TENCENT_CLOUD_SECRET_ID")
TENCENT_CLOUD_SECRET_KEY: str | None = os.getenv("TENCENT_CLOUD_SECRET_KEY")


POLARIS_PROFILES: Dict[str, Dict[str, Any]] = _build_polaris_profiles()
if not POLARIS_PROFILES:
    raise RuntimeError("至少需要配置一个 Polaris Profile")

JENKINS_PROFILES: Dict[str, Dict[str, Any]] = _build_jenkins_profiles()
if not JENKINS_PROFILES:
    raise RuntimeError("至少需要配置一个 Jenkins Profile")

DEFAULT_POLARIS_PROFILE: str = os.getenv("POLARIS_DEFAULT_PROFILE", "test")
if DEFAULT_POLARIS_PROFILE not in POLARIS_PROFILES:
    DEFAULT_POLARIS_PROFILE = next(iter(POLARIS_PROFILES.keys()))

DEFAULT_JENKINS_PROFILE: str = os.getenv("JENKINS_DEFAULT_PROFILE", "test")
if DEFAULT_JENKINS_PROFILE not in JENKINS_PROFILES:
    DEFAULT_JENKINS_PROFILE = next(iter(JENKINS_PROFILES.keys()))

POLARIS_PROFILE_OPTIONS: List[Dict[str, Any]] = [
    {
        "key": profile["key"],
        "label": profile.get("label", profile["key"]),
        "description": profile.get("description"),
    }
    for profile in POLARIS_PROFILES.values()
]

JENKINS_PROFILE_OPTIONS: List[Dict[str, Any]] = [
    {
        "key": profile["key"],
        "label": profile.get("label", profile["key"]),
        "description": profile.get("description"),
    }
    for profile in JENKINS_PROFILES.values()
]


def get_polaris_profile(profile_key: str | None) -> Dict[str, Any]:
    key = (profile_key or DEFAULT_POLARIS_PROFILE).strip()
    profile = POLARIS_PROFILES.get(key) or POLARIS_PROFILES[DEFAULT_POLARIS_PROFILE]
    return profile


def get_jenkins_profile(profile_key: str | None) -> Dict[str, Any]:
    key = (profile_key or DEFAULT_JENKINS_PROFILE).strip()
    profile = JENKINS_PROFILES.get(key) or JENKINS_PROFILES[DEFAULT_JENKINS_PROFILE]
    if not profile.get("url"):
        # 应始终存在 URL，但为了安全起见回退到默认
        profile = JENKINS_PROFILES[DEFAULT_JENKINS_PROFILE]
    return profile
