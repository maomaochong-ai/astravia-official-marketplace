"""Environment probing: can this machine run a Strix scan, and with which model?

Nothing here imports strix; probing must not pay the cost of loading the agent
engine, and the UI has to be able to answer "not installed yet" without one.

The model check mirrors `strix.interface.environment.validate_environment`
(strix/interface/environment.py:34-60) rather than inventing its own rule. That
function accepts three different ways to have a usable model, and an earlier
version of this probe only knew the third one - so a machine whose Strix was
ready through a ChatGPT subscription, a local OpenAI-compatible endpoint, or a
provider key already in the environment was reported as "no model".

It also never asks the host for its credentials: Astravia keeps provider keys in
its own main process and by design does not hand them to a plugin runtime
(docs/plugin/ai.md:3). What the plugin can do is adopt the host's *model choice*
and then say precisely which piece is still missing.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

STRIX_DIR = Path.home() / ".strix"
STRIX_CONFIG = STRIX_DIR / "cli-config.json"
SUBSCRIPTION_AUTH = STRIX_DIR / "subscription-auth.json"
CLOUD_AUTH = STRIX_DIR / "cloud-auth.json"
SANDBOX_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.4.0"

# Provider → environment variables strix accepts for that provider's key.
# litellm reads the vendor's own variable when LLM_API_KEY is absent.
PROVIDER_KEY_ENVS = {
    "openai": ("OPENAI_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY",),
    "deepseek": ("DEEPSEEK_API_KEY",),
    "openrouter": ("OPENROUTER_API_KEY",),
    "gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "google": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "xai": ("XAI_API_KEY",),
    "groq": ("GROQ_API_KEY",),
    "mistral": ("MISTRAL_API_KEY",),
    "together": ("TOGETHER_API_KEY", "TOGETHERAI_API_KEY"),
    "zai": ("ZAI_API_KEY", "ZHIPUAI_API_KEY"),
    "qwen": ("DASHSCOPE_API_KEY", "QWEN_API_KEY"),
    "moonshot": ("MOONSHOT_API_KEY",),
}

# Base URLs litellm does not know by name; without one it would call the wrong host.
PROVIDER_API_BASES = {
    "deepseek": "https://api.deepseek.com/v1",
    "zai": "https://api.z.ai/api/paas/v4",
    "moonshot": "https://api.moonshot.cn/v1",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
}


def _read_json(path: Path) -> dict[str, Any]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _read_strix_config() -> dict[str, Any]:
    env = _read_json(STRIX_CONFIG).get("env")
    return env if isinstance(env, dict) else {}


def _resolve(name: str, config_env: dict[str, Any]) -> str:
    """strix precedence: environment first, then its own config file."""
    return str(os.environ.get(name) or config_env.get(name) or "")


def _docker_ready() -> tuple[bool, str]:
    binary = shutil.which("docker")
    if not binary:
        return False, "docker is not on PATH"
    try:
        completed = subprocess.run(  # noqa: S603 - fixed argv, no shell
            [binary, "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"docker did not answer: {exc}"
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip().splitlines()
        return False, detail[0] if detail else "docker daemon is not reachable"
    return True, ""


def _python_version() -> str:
    import platform

    return platform.python_version()


def _engine_installed() -> tuple[bool, str]:
    try:
        import strix  # noqa: F401
    except Exception as exc:  # noqa: BLE001 - any import failure means "not installed"
        return False, str(exc)
    version = ""
    try:
        from importlib.metadata import version as pkg_version

        version = pkg_version("strix-agent")
    except Exception:  # noqa: BLE001
        pass
    return True, version


def _provider_of(model: str) -> str:
    return model.split("/", 1)[0].strip().lower() if "/" in model else ""


def _is_local_base(base: str) -> bool:
    host = (urlparse(base).hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"}


def _model_state(config_env: dict[str, Any]) -> dict[str, Any]:
    """Resolve the model the way strix's own validate_environment does."""
    model = _resolve("STRIX_LLM", config_env)
    api_key = _resolve("LLM_API_KEY", config_env)
    api_base = _resolve("LLM_API_BASE", config_env) or _resolve("OPENAI_BASE_URL", config_env)
    provider = _provider_of(model)

    if provider == "chatgpt":
        signed_in = SUBSCRIPTION_AUTH.is_file()
        return {
            "model": model,
            "provider": provider,
            "mode": "subscription",
            "configured": signed_in,
            "keySource": "subscription" if signed_in else "missing",
            "missing": [] if signed_in else ["subscription"],
            "detail": "" if signed_in else "not signed in to a ChatGPT subscription",
        }

    if not model:
        return {
            "model": "",
            "provider": "",
            "mode": "none",
            "configured": False,
            "keySource": "missing",
            "missing": ["model"],
            "detail": "",
        }

    env_var = next(
        (name for name in PROVIDER_KEY_ENVS.get(provider, ()) if os.environ.get(name) or config_env.get(name)),
        "",
    )
    key_source = "env" if os.environ.get("LLM_API_KEY") else "config" if config_env.get("LLM_API_KEY") else ""
    if not key_source and env_var:
        key_source = "env"
    if not key_source and api_key:
        key_source = "config"

    # A local endpoint (Ollama, LM Studio, a local gateway) needs no real key, and
    # strix's own validation treats LLM_API_KEY as optional when a base is set.
    local = bool(api_base) and _is_local_base(api_base)
    key_ok = bool(api_key or env_var or local)
    cloud = bool(
        _resolve("STRIX_API_TOKEN", config_env) or CLOUD_AUTH.is_file() or (STRIX_DIR / "cloud.json").is_file()
    )

    missing: list[str] = []
    if not key_ok:
        missing.append("key")
    return {
        "model": model,
        "provider": provider,
        "mode": "api",
        "configured": key_ok,
        "keySource": key_source or ("local" if local else "missing"),
        # Name the variable the user would have to set even when it is absent: a hint
        # that only appears once it is already set helps nobody.
        "keyEnv": env_var or next(iter(PROVIDER_KEY_ENVS.get(provider, ())), "LLM_API_KEY"),
        "apiBase": api_base,
        "missing": missing,
        "cloudAvailable": cloud,
        "detail": ""
        if key_ok
        else (
            f"set LLM_API_KEY (or {env_var})"
            if env_var
            else f"set LLM_API_KEY or {next(iter(PROVIDER_KEY_ENVS.get(provider, ())), 'LLM_API_KEY')}"
        ),
    }


def configure_model(model: str, api_base: str = "", api_key: str = "") -> dict[str, Any]:
    """Write the model choice into strix's own config, leaving the rest untouched.

    The plugin may adopt the host's model *name*; it never receives the host's key,
    so a blank `api_key` keeps whatever strix already has.
    """
    model = (model or "").strip()
    if not model:
        raise ValueError("model is required")
    payload = _read_json(STRIX_CONFIG)
    env = payload.get("env") if isinstance(payload.get("env"), dict) else {}
    env["STRIX_LLM"] = model
    if api_base.strip():
        env["LLM_API_BASE"] = api_base.strip()
    elif _provider_of(model) in PROVIDER_API_BASES:
        env.setdefault("LLM_API_BASE", PROVIDER_API_BASES[_provider_of(model)])
    if api_key.strip():
        env["LLM_API_KEY"] = api_key.strip()
    payload["env"] = env
    STRIX_DIR.mkdir(parents=True, exist_ok=True)
    STRIX_CONFIG.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    try:
        STRIX_CONFIG.chmod(0o600)
    except OSError:
        pass
    return {"model": model, "configPath": str(STRIX_CONFIG)}


def probe() -> dict[str, Any]:
    """Everything the settings and launch surfaces need, in one round trip."""
    config_env = _read_strix_config()
    installed, detail = _engine_installed()
    docker_ok, docker_detail = _docker_ready()
    llm = _model_state(config_env)

    return {
        "python": {"version": _python_version(), "executable": os.sys.executable, "found": True},
        "engine": {"installed": installed, "version": detail},
        "docker": {"ready": docker_ok, "detail": docker_detail, "image": SANDBOX_IMAGE},
        "llm": llm,
        "configPath": str(STRIX_CONFIG),
        # A scan needs the engine, the sandbox and a model; only the model is
        # something the plugin can line up with the host for the user.
        "ready": bool(installed and docker_ok and llm["configured"]),
    }
