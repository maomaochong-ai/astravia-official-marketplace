#!/bin/sh
# kali.sh — drive a local Kali Linux environment for the kali-linux skill.
#
# Backends: docker (macOS/Linux default), wsl (Windows via WSL2), native (this
# machine runs Kali), ssh (a Kali host the user points us at).
#
# Usage:
#   kali.sh status
#   kali.sh install
#   kali.sh run "<command>"
#   kali.sh script <<'EOF' … EOF
#   kali.sh ensure <tool> [tool…] | --profile headless
#   kali.sh tools
#   kali.sh stop | reset
#
# Environment:
#   KALI_BACKEND=docker|wsl|native|ssh   force a backend
#   KALI_SSH=user@host                   ssh backend target
#   KALI_IMAGE=kalilinux/kali-rolling:latest
#   KALI_CONTAINER=astravia-kali
#   KALI_WORKDIR=<dir>                   host directory mounted at /work
#   KALI_STATE_DIR=~/.astravia-kali      audit log and state
#   KALI_TIMEOUT=300                     per-command seconds

set -eu

IMAGE=${KALI_IMAGE:-kalilinux/kali-rolling:latest}
CONTAINER=${KALI_CONTAINER:-astravia-kali}
WORKDIR=${KALI_WORKDIR:-$PWD}
STATE_DIR=${KALI_STATE_DIR:-$HOME/.astravia-kali}
CACHE_VOLUME=${KALI_CACHE_VOLUME:-astravia-kali-apt}
TIMEOUT=${KALI_TIMEOUT:-300}
AUDIT_LOG="$STATE_DIR/audit.log"
WSL_DISTRO=${KALI_WSL_DISTRO:-kali-linux}

log() { printf '%s\n' "$*" >&2; }
die() { log "error: $*"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- backends ---

detect_backend() {
	if [ -n "${KALI_BACKEND:-}" ]; then
		printf '%s\n' "$KALI_BACKEND"
		return 0
	fi
	if [ -n "${KALI_SSH:-}" ]; then
		printf 'ssh\n'
		return 0
	fi
	case "$(uname -s)" in
	Darwin) printf 'docker\n' ;;
	Linux)
		if [ -r /etc/os-release ] && grep -qi '^ID=kali' /etc/os-release 2>/dev/null; then
			printf 'native\n'
		else
			printf 'docker\n'
		fi
		;;
	MINGW* | MSYS* | CYGWIN*) printf 'wsl\n' ;;
	*) printf 'none\n' ;;
	esac
}

docker_reachable() { have docker && docker info >/dev/null 2>&1; }

container_state() {
	if ! docker_reachable; then
		printf 'unknown\n'
		return 0
	fi
	# docker inspect prints an empty line plus an error for a missing object, so
	# the state has to be normalised instead of trusting the raw output.
	running=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | tr -d '[:space:]' || true)
	case "$running" in
	true | false) printf '%s\n' "$running" ;;
	*) printf 'missing\n' ;;
	esac
}

ensure_container() {
	state=$(container_state)
	case "$state" in
	true) return 0 ;;
	false)
		log "starting container $CONTAINER …"
		docker start "$CONTAINER" >/dev/null
		;;
	missing)
		log "creating container $CONTAINER from $IMAGE …"
		docker run -d --name "$CONTAINER" --hostname kali \
			-v "$WORKDIR:/work" \
			-v "$CACHE_VOLUME:/var/cache/apt/archives" \
			-w /work "$IMAGE" sleep infinity >/dev/null
		;;
	*) log "error: docker is not reachable; see references/install.md (docker daemon down?)"; return 1 ;;
	esac
}

# -------------------------------------------------------------- execution ---

kali_exec() {
	cmd=$1
	case "$BACKEND" in
	docker)
		ensure_container || return 1
		docker exec -i -e DEBIAN_FRONTEND=noninteractive "$CONTAINER" \
			timeout "$TIMEOUT" bash -lc "$cmd"
		;;
	native)
		if have timeout; then
			timeout "$TIMEOUT" bash -lc "$cmd"
		else
			log "warning: no timeout binary on this host; running without a time limit"
			bash -lc "$cmd"
		fi
		;;
	ssh)
		quoted=$(printf '%s' "$cmd" | sed "s/'/'\\\\''/g")
		ssh -o BatchMode=yes -o ConnectTimeout=10 "$KALI_SSH" \
			"timeout $TIMEOUT bash -lc '$quoted'"
		;;
	wsl)
		wsl.exe -d "$WSL_DISTRO" --cd "$WORKDIR" -- bash -lc "$cmd"
		;;
	*)
		log "error: no Kali backend available; run 'kali.sh install' first"; return 1
		;;
	esac
}

audit() {
	mkdir -p "$STATE_DIR" 2>/dev/null || true
	# One record per line: a multi-line script body would otherwise split the record and
	# break the tab-separated format the docs promise.
	text=$(printf '%s' "$2" | awk 'BEGIN { ORS = "" } NR > 1 { printf "\\n" } { printf "%s", $0 }')
	printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BACKEND" "$1" "$text" >>"$AUDIT_LOG" 2>/dev/null || true
}

run_audited() {
	cmd=$1
	audit START "$cmd"
	set +e
	kali_exec "$cmd"
	rc=$?
	set -e
	audit "EXIT=$rc" "$cmd"
	return $rc
}

# ---------------------------------------------------------------- commands ---

cmd_status() {
	BACKEND=$(detect_backend)
	ready=false
	hint=
	kali_version=
	image_present=false
	runtime=

	runtime=$IMAGE
	case "$BACKEND" in
	docker)
		if ! have docker; then
			hint="docker CLI not installed; run 'kali.sh install'"
		elif ! docker_reachable; then
			runtime="none"
			hint="docker daemon not running; start colima or Docker Desktop, or run 'kali.sh install'"
		else
			state=$(container_state)
			if [ "$state" = "missing" ]; then
				hint="container $CONTAINER not created yet; run 'kali.sh install'"
			elif [ "$state" = "false" ]; then
				hint="container $CONTAINER is stopped; 'kali.sh run' will start it"
				ready=true
			else
				ready=true
			fi
			if docker image inspect "$IMAGE" >/dev/null 2>&1; then image_present=true; fi
			if [ "$ready" = "true" ]; then
				kali_version=$(docker exec "$CONTAINER" sh -c '. /etc/os-release 2>/dev/null && printf "%s" "$PRETTY_NAME"' 2>/dev/null || true)
			fi
		fi
		;;
	wsl)
		runtime="wsl:$WSL_DISTRO"
		if ! have wsl.exe; then
			hint="wsl.exe not found; this backend only exists on Windows"
		elif wsl.exe -d "$WSL_DISTRO" -- true >/dev/null 2>&1; then
			ready=true
			kali_version=$(wsl.exe -d "$WSL_DISTRO" -- sh -c '. /etc/os-release && printf "%s" "$PRETTY_NAME"' 2>/dev/null | tr -d '\r' || true)
		else
			hint="WSL distribution $WSL_DISTRO not registered; run 'kali.ps1 install' in an elevated PowerShell"
		fi
		;;
	native)
		ready=true
		runtime="native"
		kali_version=$(sh -c '. /etc/os-release && printf "%s" "$PRETTY_NAME"' 2>/dev/null || true)
		;;
	ssh)
		runtime=$KALI_SSH
		if ssh -o BatchMode=yes -o ConnectTimeout=8 "$KALI_SSH" true >/dev/null 2>&1; then
			ready=true
			kali_version=$(ssh -o BatchMode=yes "$KALI_SSH" '. /etc/os-release && printf "%s" "$PRETTY_NAME"' 2>/dev/null || true)
		else
			hint="cannot reach $KALI_SSH over ssh (key auth only)"
		fi
		;;
	*)
		hint="unsupported platform $(uname -s)"
		;;
	esac

	printf 'backend=%s\n' "$BACKEND"
	printf 'ready=%s\n' "$ready"
	printf 'runtime=%s\n' "$runtime"
	printf 'image=%s\n' "$IMAGE"
	printf 'container=%s\n' "$CONTAINER"
	printf 'image_present=%s\n' "$image_present"
	printf 'workdir=%s\n' "$WORKDIR"
	printf 'audit_log=%s\n' "$AUDIT_LOG"
	[ -n "$kali_version" ] && printf 'kali_version=%s\n' "$kali_version"
	[ -n "$hint" ] && printf 'hint=%s\n' "$hint"
	return 0
}

# `doctor` speaks the same [PASS]/[FAIL] dialect as the docx and xlsx skills so a
# user who has run one of those recognises the output immediately. Unlike
# `status`, it exits non-zero when something needed is missing: this is the
# command to run when you want a verdict, not a state dump. Probes deliberately
# bypass kali_exec: a diagnosis must not create a container, start one, or write
# audit records.
cmd_doctor() {
	BACKEND=$(detect_backend)
	fails=0
	report() { # mark label detail
		printf '[%s] %-26s %s\n' "$1" "$2" "${3:-}"
		if [ "$1" = FAIL ]; then fails=$((fails + 1)); fi
		return 0
	}
	probe() {
		case "$BACKEND" in
		docker) docker exec "$CONTAINER" bash -lc "$1" 2>/dev/null ;;
		native) bash -lc "$1" 2>/dev/null ;;
		ssh)
			quoted=$(printf '%s' "$1" | sed "s/'/'\\\\''/g")
			ssh -o BatchMode=yes -o ConnectTimeout=8 "$KALI_SSH" "bash -lc '$quoted'" 2>/dev/null
			;;
		wsl) wsl.exe -d "$WSL_DISTRO" --cd "$WORKDIR" -- bash -lc "$1" 2>/dev/null ;;
		*) return 1 ;;
		esac
	}

	report PASS backend "$BACKEND"

	case "$BACKEND" in
	docker)
		if have docker; then
			report PASS 'docker CLI' "$(docker --version 2>/dev/null | head -1)"
		else
			report FAIL 'docker CLI' "not installed; run 'kali.sh install'"
		fi
		if have docker; then
			if docker_reachable; then
				report PASS 'docker daemon' reachable
			else
				report FAIL 'docker daemon' "not reachable; start colima or Docker Desktop"
			fi
			if docker image inspect "$IMAGE" >/dev/null 2>&1; then
				report PASS 'image' "$IMAGE"
			else
				report FAIL 'image' "$IMAGE missing; run 'kali.sh install'"
			fi
			case "$(container_state)" in
			missing) report WARN container "$CONTAINER not created; 'kali.sh install' creates it" ;;
			false) report WARN container "$CONTAINER is stopped; 'kali.sh run' starts it" ;;
			*) report PASS container "$CONTAINER (running)" ;;
			esac
		fi
		;;
	native)
		report PASS runtime "native $(sh -c '. /etc/os-release 2>/dev/null && printf "%s" "$PRETTY_NAME"' 2>/dev/null || true)"
		;;
	ssh)
		if have ssh; then report PASS 'ssh client' "$(command -v ssh)"; else report FAIL 'ssh client' 'not installed'; fi
		if have ssh && ssh -o BatchMode=yes -o ConnectTimeout=8 "$KALI_SSH" true >/dev/null 2>&1; then
			report PASS 'ssh target' "$KALI_SSH reachable"
		else
			report FAIL 'ssh target' "cannot reach $KALI_SSH (key auth only)"
		fi
		;;
	wsl)
		if have wsl.exe; then
			report PASS 'wsl.exe' "$(command -v wsl.exe)"
		else
			report FAIL 'wsl.exe' "not found; enable the WSL optional feature, then reboot"
		fi
		if have wsl.exe; then
			if wsl.exe -d "$WSL_DISTRO" -- true >/dev/null 2>&1; then
				report PASS 'distribution' "$WSL_DISTRO registered"
			else
				report FAIL 'distribution' "$WSL_DISTRO not registered; run 'kali.ps1 install' elevated"
			fi
		fi
		;;
	*)
		report FAIL platform "unsupported platform $(uname -s); no backend available"
		;;
	esac

	if probe true >/dev/null 2>&1; then
		if probe 'touch .kali-doctor && rm -f .kali-doctor' >/dev/null 2>&1; then
			report PASS workdir "$WORKDIR writable inside Kali"
		else
			report FAIL workdir "$WORKDIR not writable inside Kali"
		fi
		report PASS 'kali version' "$(probe '. /etc/os-release && printf "%s" "$PRETTY_NAME"' || true)"
		missing=$(probe 'for t in nmap masscan sqlmap hydra john hashcat nikto gobuster ffuf whatweb wpscan dirb dnsrecon whois smbclient msfconsole tshark tcpdump aircrack-ng binwalk foremost exiftool socat nc python3; do command -v "$t" >/dev/null 2>&1 || printf "%s " "$t"; done' || true)
		total=23
		absent=0
		if [ -n "$missing" ]; then absent=$(printf '%s' "$missing" | wc -w | tr -d ' '); fi
		if [ "$absent" -eq 0 ]; then
			report PASS tools "$total/$total key tools present"
		else
			report WARN tools "$((total - absent))/$total present; missing $(printf '%s' "$missing" | sed 's/ *$//')"
		fi
	else
		report WARN 'inside Kali' 'not runnable yet; checks that need the distribution were skipped'
	fi

	mkdir -p "$STATE_DIR" 2>/dev/null || true
	if [ -w "$STATE_DIR" ]; then
		report PASS 'audit log' "$AUDIT_LOG"
	else
		report FAIL 'audit log' "$STATE_DIR is not writable"
	fi

	if [ "$fails" -gt 0 ]; then
		printf '\nNOT READY (%s check(s) failed; see FAIL above)\n' "$fails"
		return 1
	fi
	printf '\nREADY\n'
	return 0
}

cmd_install() {
	BACKEND=$(detect_backend)
	log "backend: $BACKEND"
	case "$BACKEND" in
	docker)
		if ! have docker; then
			case "$(uname -s)" in
			Darwin)
				have brew ||
					die "Homebrew is required to install the Docker CLI automatically.
  Install Homebrew (https://brew.sh) or Docker Desktop, then re-run install."
				log "installing the docker CLI and colima through Homebrew (a few minutes) …"
				brew install docker colima
				;;
			*)
				die "docker is not installed. Install it with your package manager
  (for example: sudo apt install -y docker.io) or with Docker Desktop, then re-run install."
				;;
			esac
		fi
		if ! docker_reachable; then
			if have colima; then
				log "starting colima (container runtime) …"
				colima start
			else
				die "the Docker daemon is not reachable. Open Docker Desktop (or install colima), then re-run install."
			fi
		fi
		log "pulling $IMAGE …"
		docker pull "$IMAGE"
		ensure_container
		log "Kali is ready. Re-run 'kali.sh status' to confirm."
		;;
	wsl)
		if have powershell.exe; then
			log "delegating to kali.ps1 install (needs an elevated shell for first-time WSL setup) …"
			powershell.exe -ExecutionPolicy Bypass -File "$(dirname "$0")/kali.ps1" install
		else
			die "run scripts/kali.ps1 install from PowerShell on Windows"
		fi
		;;
	native)
		log "this machine already runs Kali; nothing to install"
		;;
	ssh)
		log "ssh backend uses the remote host as-is; nothing to install locally"
		;;
	*)
		die "unsupported platform $(uname -s)"
		;;
	esac
}

cmd_run() {
	[ $# -ge 1 ] || die "usage: kali.sh run \"<command>\""
	BACKEND=$(detect_backend)
	run_audited "$*"
}

cmd_script() {
	BACKEND=$(detect_backend)
	body=$(cat)
	[ -n "$body" ] || die "no script on stdin"
	run_audited "$body"
}

package_for() {
	case "$1" in
	nc | netcat) printf 'netcat-traditional\n' ;;
	msf | metasploit) printf 'metasploit-framework\n' ;;
	enum4linux) printf 'enum4linux\n' ;;
	seclists | wordlists) printf 'seclists\n' ;;
	dig | nslookup) printf 'dnsutils\n' ;;
	impacket) printf 'python3-impacket\n' ;;
	responder) printf 'responder\n' ;;
	tcpdump | tshark | wireshark) printf '%s\n' "$1" ;;
	nmap | masscan | sqlmap | hydra | john | hashcat | nikto | gobuster | ffuf | \
		whatweb | wpscan | dirb | dnsrecon | whois | smbclient | aircrack-ng | \
		binwalk | foremost | exiftool | socat | curl | git | python3-pip | \
		bloodhound | crackmapexec | feroxbuster | amass) printf '%s\n' "$1" ;;
	*) printf '%s\n' "$1" ;;
	esac
}

cmd_ensure() {
	[ $# -ge 1 ] || die "usage: kali.sh ensure <tool> [tool…] | --profile headless"
	BACKEND=$(detect_backend)
	packages=
	if [ "$1" = "--profile" ]; then
		shift
		case "${1:-headless}" in
		headless | full) packages=kali-linux-headless ;;
		*) die "unknown profile '${1}' (known: headless)" ;;
		esac
	else
		for tool in "$@"; do
			packages="$packages $(package_for "$tool")"
		done
	fi
	log "ensuring:$packages"
	run_audited "export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || { echo 'apt-get update failed' >&2; exit 1; }
apt-get install -y --no-install-recommends$packages"
}

cmd_tools() {
	BACKEND=$(detect_backend)
	run_audited 'for t in nmap masscan sqlmap hydra john hashcat nikto gobuster ffuf whatweb wpscan dirb dnsrecon whois smbclient msfconsole tshark tcpdump aircrack-ng binwalk foremost exiftool socat nc python3; do
  if command -v "$t" >/dev/null 2>&1; then printf "%-16s %s\n" "$t" "$(command -v "$t")"; else printf "%-16s %s\n" "$t" "-"; fi
done'
}

cmd_stop() {
	BACKEND=$(detect_backend)
	case "$BACKEND" in
	docker)
		if [ "$(container_state)" = "true" ]; then
			docker stop "$CONTAINER" >/dev/null
			log "container $CONTAINER stopped (kept: tools, apt cache, audit log)"
		else
			log "container $CONTAINER is not running"
		fi
		;;
	*) log "backend $BACKEND has nothing to stop" ;;
	esac
}

cmd_reset() {
	BACKEND=$(detect_backend)
	[ "$BACKEND" = "docker" ] || die "reset only applies to the docker backend"
	log "removing container $CONTAINER (audit log and /work data are kept) …"
	docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
	log "done; the next 'install' or 'run' recreates it"
}

usage() {
	cat <<'EOF'
kali.sh — drive a local Kali Linux environment

  status                     detect backend and readiness (always exit 0)
  doctor                     the same checks as PASS/FAIL lines; exit 1 if a check fails
  install                    install / provision Kali for this OS
  run "<command>"            run one command inside Kali
  script                     run a script from stdin inside Kali
  ensure <tool|--profile headless>
                             apt-install tools, skipping what is present
  tools                      show which key tools are installed
  stop                       stop the container, keep its state
  reset                      delete the container (docker backend)

Docs: references/install.md, references/runbook.md, references/safety.md
EOF
}

main() {
	[ $# -ge 1 ] || {
		usage
		exit 64
	}
	action=$1
	shift
	case "$action" in
	status) cmd_status ;;
	doctor) cmd_doctor || exit $? ;;
	install) cmd_install ;;
	run) cmd_run "$@" ;;
	script) cmd_script ;;
	ensure) cmd_ensure "$@" ;;
	tools) cmd_tools ;;
	stop) cmd_stop ;;
	reset) cmd_reset ;;
	help | -h | --help) usage ;;
	*) die "unknown command '$action' (try: kali.sh help)" ;;
	esac
}

main "$@"
