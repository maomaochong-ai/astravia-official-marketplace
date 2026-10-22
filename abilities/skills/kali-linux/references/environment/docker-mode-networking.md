# Docker Networking

> **In this skill:** `scripts/kali.sh` owns backend detection, provisioning and command execution. Every `docker exec ...` / `ssh user@host "..."` in this document is `sh "$SKILL/scripts/kali.sh" run "..."` here; setup steps below are superseded by `install`. Kept for the operational caveats, which still apply.



Docker networking can differ significantly between native Linux and Docker Desktop for macOS/Windows. Always verify reachability from inside the Kali container before scanning.

## Raw Sockets

Raw-socket tools such as nmap SYN scan (`-sS`) and OS detection (`-O`) need a container created with `--privileged --network host`.

```bash
# Use the persistent container created with --network host and --privileged
docker exec -it astravia-kali bash

# Example raw-socket scan
nmap -sS 10.0.0.0/24
```

If raw-socket tools fail because the container lacks these flags, preserve results first and create a corrected persistent container.

If nmap SYN scan (`-sS`) still fails, use TCP connect scan (`-sT`) when acceptable.

## Reachability Checks

If a target is reachable from the host but unreachable from the Kali container, diagnose before scanning:

```bash
# Inside the container
ip addr
ip route
ping -c 3 <target>
ip neigh

# From the host, verify the same target separately
ping -c 3 <target>
```

If the host can reach the target but the container cannot, treat it as a Docker routing/NAT limitation. Prefer SSH to a full Kali VM/server for same-LAN, ARP-dependent, raw-socket, wireless, or service-heavy work.

## Route Troubleshooting

Do not copy route commands from another environment. Discover the correct target CIDR, gateway, and interface first:

```bash
# Example only: replace all placeholders after confirming the topology
ip route add <target_cidr> via <docker_gateway> dev <container_interface>
ip route get <target_ip>
```

Container routes, gateway names, and interface names may change after restart. Re-check `ip route` before later scans if a temporary route was added.

## Docker Desktop Limitations

On Docker Desktop for macOS/Windows, `--network host` and bridge behavior differ from native Linux. The container may not behave like a host-networked Linux container, and same-LAN/ARP-dependent scans may be unreliable.

Use SSH/server mode instead of Docker when the task requires:

- same-LAN ARP visibility,
- wireless monitor mode or packet injection,
- stable raw-socket behavior,
- service-heavy stacks such as GVM/OpenVAS, Neo4j/BloodHound, ZAP daemon, or Metasploit database,
- direct hardware access.
