"""Cisco IOS configuration generator using Jinja2 templates."""

from __future__ import annotations

from typing import Dict, Any, Optional
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from loguru import logger

from .models import IntendedConfig
from .validators import validate_config


class ConfigGenerator:
    """Generate Cisco IOS CLI from intended configuration using Jinja2 templates."""

    def __init__(self):
        template_dir = Path(__file__).parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def generate(self, config: IntendedConfig) -> Dict[str, Any]:
        """Generate configuration from intended config."""
        validation = validate_config(config)

        if not validation.is_valid:
            return {
                "perModule": {},
                "merged": "",
                "warnings": validation.warnings,
                "errors": validation.errors,
            }

        per_module: Dict[str, str] = {}

        # Base config (hostname, users, SSH, enable secret, banner, vty)
        base_cfg = self._render_base(config)
        if base_cfg:
            per_module["base"] = base_cfg

        # Addressing (needs switchType for mgmt behavior)
        if config.addressing:
            per_module["addressing"] = self._render_addressing(
                config.addressing, switch_type=config.switch_type
            )

        if config.switching:
            per_module["switching"] = self._render_switching(config.switching)

        if config.routing:
            per_module["routing"] = self._render_routing(config.routing)

        # Security template stays for ACLs; device access is handled in base.j2
        if config.security:
            per_module["security"] = self._render_security(config.security)

        if config.services:
            per_module["services"] = self._render_services(config.services)

        merged = self._merge_config(per_module)

        return {
            "perModule": per_module,
            "merged": merged,
            "warnings": validation.warnings,
            "errors": [],
        }

    # ---------------- helpers ----------------

    def _dump(self, obj: Any, *, by_alias: bool = True) -> Any:
        """Safely dump pydantic models or passthrough dict/list."""
        if obj is None:
            return None
        if isinstance(obj, list):
            return [self._dump(x, by_alias=by_alias) for x in obj]
        if isinstance(obj, dict):
            return obj
        if hasattr(obj, "model_dump"):
            try:
                return obj.model_dump(by_alias=by_alias)
            except TypeError:
                return obj.model_dump()
        return obj

    def _first_existing(self, d: dict, keys: list, default=None):
        for k in keys:
            if k in d and d[k] is not None:
                return d[k]
        return default

    # ---------------- Base ----------------

    def _render_base(self, config: IntendedConfig) -> str:
        try:
            template = self.env.get_template("base.j2")

            device_access: dict = {}
            if config.security and getattr(config.security, "device_access", None):
                # base.j2 uses the explicit variables we compute below, so alias doesn't matter here
                device_access = self._dump(config.security.device_access, by_alias=True) or {}

            users = device_access.get("users") or []
            enable_secret = device_access.get("enableSecret")
            service_password_encryption = bool(device_access.get("servicePasswordEncryption", False))
            banner_motd = device_access.get("bannerMotd")

            ssh = device_access.get("ssh") or {}
            ssh_enabled = bool(ssh.get("enabled", False))
            domain_name = ssh.get("domainName") if ssh_enabled else None
            rsa_modulus = ssh.get("rsaModulus") if ssh_enabled else None
            ssh_version = ssh.get("version") if ssh_enabled else None
            vty_start = ssh.get("vtyStart") if ssh_enabled else 0
            vty_end = ssh.get("vtyEnd") if ssh_enabled else 4
            allow_telnet = bool(ssh.get("allowTelnet", False)) if ssh_enabled else False
            exec_timeout_min = ssh.get("execTimeoutMin") if ssh_enabled else None
            exec_timeout_sec = ssh.get("execTimeoutSec") if ssh_enabled else None

            return template.render(
                hostname=config.hostname,
                enable_secret=enable_secret,
                service_password_encryption=service_password_encryption,
                banner_motd=banner_motd,
                users=users,
                ssh_enabled=ssh_enabled,
                domain_name=domain_name,
                rsa_modulus=rsa_modulus,
                ssh_version=ssh_version,
                vty_start=vty_start,
                vty_end=vty_end,
                allow_telnet=allow_telnet,
                exec_timeout_min=exec_timeout_min,
                exec_timeout_sec=exec_timeout_sec,
            ).strip()

        except Exception as e:
            logger.warning(f"Template error in base.j2, skipping base config: {e}")
            return ""

    # ---------------- Addressing ----------------

    def _render_addressing(self, addressing: Any, switch_type: Optional[str] = None) -> str:
        """Render addressing using snake_case template keys."""
        try:
            template = self.env.get_template("addressing.j2")

            a = self._dump(addressing, by_alias=False) or {}
            management = a.get("management")
            vlan_interfaces = a.get("vlan_interfaces", []) or []
            interfaces = a.get("interfaces", []) or []
            subinterfaces = a.get("subinterfaces", []) or []

            # Avoid duplicate SVI block if vlan_interfaces contains same VLAN as management
            if management and isinstance(management, dict):
                mgmt_vlan = management.get("vlan_id")
                if mgmt_vlan is not None:
                    vlan_interfaces = [
                        svi
                        for svi in vlan_interfaces
                        if not (isinstance(svi, dict) and svi.get("vlan_id") == mgmt_vlan)
                    ]

            return template.render(
                switchType=switch_type,
                management=management,
                vlanInterfaces=vlan_interfaces,  # template variable name kept for compatibility
                interfaces=interfaces,
                subinterfaces=subinterfaces,
            ).strip()
        except Exception as e:
            logger.warning(f"Template error, using fallback: {e}")
            return self._fallback_addressing(addressing, switch_type=switch_type)

    def _fallback_addressing(self, addressing: Any, switch_type: Optional[str] = None) -> str:
        """Fallback renderer (supports both camelCase + snake_case dicts)."""
        lines = []
        a = self._dump(addressing, by_alias=True) or {}

        mgmt = a.get("management")
        vlan_interfaces = a.get("vlanInterfaces", []) or a.get("vlan_interfaces", []) or []
        routed_ifaces = a.get("interfaces", []) or []
        subifs = a.get("subinterfaces", []) or []

        if switch_type == "msw":
            has_any_l3 = False

            if mgmt and isinstance(mgmt, dict):
                if (mgmt.get("ipAddress") and mgmt.get("subnetMask")) or mgmt.get("defaultRouteNextHop"):
                    has_any_l3 = True

            for svi in vlan_interfaces:
                if isinstance(svi, dict) and svi.get("ipAddress") and svi.get("subnetMask"):
                    has_any_l3 = True
                    break

            if not has_any_l3:
                for iface in routed_ifaces:
                    if isinstance(iface, dict) and iface.get("ipAddress") and iface.get("subnetMask"):
                        has_any_l3 = True
                        break

            if not has_any_l3:
                for sub in subifs:
                    if isinstance(sub, dict) and sub.get("ipAddress") and sub.get("subnetMask"):
                        has_any_l3 = True
                        break

            if has_any_l3:
                lines.append("ip routing")
                lines.append("!")

        mgmt_vlan_id = None
        if mgmt:
            vlan_id = mgmt.get("vlanId", mgmt.get("vlan_id", 99))
            mgmt_vlan_id = vlan_id
            ip = mgmt.get("ipAddress", mgmt.get("ip_address", ""))
            mask = mgmt.get("subnetMask", mgmt.get("subnet_mask", "255.255.255.0"))

            lines.append(f"interface Vlan{vlan_id}")
            if ip and mask:
                lines.append(f" ip address {ip} {mask}")
            lines.append(" no shutdown")
            lines.append("!")

            if switch_type == "l2":
                gw = mgmt.get("defaultGateway", mgmt.get("default_gateway"))
                if gw:
                    lines.append(f"ip default-gateway {gw}")
                    lines.append("!")
            elif switch_type == "msw":
                nh = mgmt.get("defaultRouteNextHop", mgmt.get("default_route_next_hop"))
                if nh:
                    lines.append(f"ip route 0.0.0.0 0.0.0.0 {nh}")
                    lines.append("!")

        for svi in vlan_interfaces:
            if not isinstance(svi, dict):
                continue
            vlan_id = svi.get("vlanId", svi.get("vlan_id"))
            if vlan_id is None:
                continue
            if mgmt_vlan_id is not None and vlan_id == mgmt_vlan_id:
                continue

            ip = svi.get("ipAddress", svi.get("ip_address", ""))
            mask = svi.get("subnetMask", svi.get("subnet_mask", "255.255.255.0"))
            desc = svi.get("description")
            shutdown = bool(svi.get("shutdown", False))

            lines.append(f"interface Vlan{vlan_id}")
            if desc:
                lines.append(f" description {desc}")
            if ip and mask:
                lines.append(f" ip address {ip} {mask}")
            lines.append(" shutdown" if shutdown else " no shutdown")
            lines.append("!")

        for iface in routed_ifaces:
            iface_name = iface.get("interface") or iface.get("name")
            ip = iface.get("ipAddress") or iface.get("ip_address")
            mask = iface.get("subnetMask") or iface.get("subnet_mask")
            desc = iface.get("description")
            shutdown = iface.get("shutdown", False)

            lines.append(f"interface {iface_name}")
            if desc:
                lines.append(f" description {desc}")
            if ip and mask:
                lines.append(f" ip address {ip} {mask}")
            lines.append(" no shutdown" if not shutdown else " shutdown")
            lines.append("!")

        for sub in subifs:
            parent = sub.get("parentInterface") or sub.get("parent_interface")
            vlan_id = sub.get("vlanId") or sub.get("vlan_id")
            ip = sub.get("ipAddress") or sub.get("ip_address")
            mask = sub.get("subnetMask") or sub.get("subnet_mask")
            desc = sub.get("description")

            lines.append(f"interface {parent}.{vlan_id}")
            if desc:
                lines.append(f" description {desc}")
            lines.append(f" encapsulation dot1Q {vlan_id}")
            if ip and mask:
                lines.append(f" ip address {ip} {mask}")
            lines.append("!")

        return "\n".join(lines)

    # ---------------- Switching ----------------

    def _normalize_switching_for_template(self, switching: Any) -> dict:
        """Convert switching config into the structure expected by switching.j2."""
        # switching.j2 in this project expects camelCase keys (UI aligned)
        s = self._dump(switching, by_alias=True)
        if not isinstance(s, dict):
            return {"vlans": [], "stp": None, "accessPorts": [], "trunkPorts": [], "etherChannels": []}

        # VLANs
        raw_vlans = self._first_existing(s, ["vlans"], default=[]) or []
        vlans = []
        for v in raw_vlans:
            vd = v if isinstance(v, dict) else self._dump(v, by_alias=True)
            vlan_id = self._first_existing(vd, ["vlanId", "vlan_id", "id"], default=10)
            name = self._first_existing(vd, ["name"], default=f"VLAN{vlan_id}")
            try:
                vlan_id_int = int(vlan_id)
            except Exception:
                vlan_id_int = 10
            vlans.append({"vlanId": vlan_id_int, "name": name})

        # --- STP (supports BOTH old and new UI shapes) ---
        stp = None

        # Old shape: "stp" object
        if isinstance(s.get("stp"), dict):
            stp = s.get("stp")

        # Legacy: "spanningTree"
        if stp is None:
            legacy_stp = s.get("spanningTree") or s.get("spanning_tree")
            if legacy_stp:
                ls = legacy_stp if isinstance(legacy_stp, dict) else self._dump(legacy_stp, by_alias=True)
                mode = self._first_existing(ls, ["mode"], default="rapid-pvst")

                root_primary = ls.get("rootPrimaryVlans") or ls.get("root_primary_vlans") or []
                root_secondary = ls.get("rootSecondaryVlans") or ls.get("root_secondary_vlans") or []

                vlan_list = None
                role = "primary"
                if root_primary:
                    vlan_list = ",".join(str(x) for x in root_primary)
                    role = "primary"
                elif root_secondary:
                    vlan_list = ",".join(str(x) for x in root_secondary)
                    role = "secondary"

                stp = {
                    "mode": mode,
                    "vlanScope": "custom" if vlan_list else "all",
                    "vlans": vlan_list or "",
                    "rootMode": "primarySecondary",
                    "rootRole": role,
                }

        # New UI: stpMode + stpRoots (current models)
        if stp is None:
            stp_mode = s.get("stpMode")
            stp_roots = s.get("stpRoots") or []
            if stp_mode or stp_roots:
                mode = stp_mode or "rapid-pvst"
                root_mode = "primarySecondary"
                root_role = "primary"
                vlan_scope = "all"
                vlan_list = ""
                priority = None

                if isinstance(stp_roots, list) and len(stp_roots) > 0 and isinstance(stp_roots[0], dict):
                    r0 = stp_roots[0]
                    vlan_scope = r0.get("vlanScope", "all")
                    vlan_list = r0.get("vlans", "") if vlan_scope == "custom" else ""
                    root_mode = r0.get("mode", "primarySecondary")
                    root_role = r0.get("role", "primary")
                    priority = r0.get("priority")

                stp = {
                    "mode": mode,
                    "vlanScope": vlan_scope,
                    "vlans": vlan_list,
                    "rootMode": root_mode,
                    "rootRole": root_role,
                    "priority": priority,
                }

        # Access Ports
        raw_access = self._first_existing(s, ["accessPorts", "access_ports"], default=[]) or []
        access_ports = []
        for p in raw_access:
            pd = p if isinstance(p, dict) else self._dump(p, by_alias=True)
            access_ports.append(
                {
                    "interface": self._first_existing(pd, ["interface"], default="GigabitEthernet0/1"),
                    "vlanId": int(self._first_existing(pd, ["vlanId", "vlan_id"], default=10)),
                    "portfast": bool(self._first_existing(pd, ["portfast"], default=True)),
                    "bpduGuard": bool(self._first_existing(pd, ["bpduGuard", "bpdu_guard"], default=True)),
                    "description": self._first_existing(pd, ["description"], default=None),
                }
            )

        # Trunk Ports
        raw_trunks = self._first_existing(s, ["trunkPorts", "trunk_ports"], default=[]) or []
        trunk_ports = []
        for p in raw_trunks:
            pd = p if isinstance(p, dict) else self._dump(p, by_alias=True)
            trunk_ports.append(
                {
                    "interface": self._first_existing(pd, ["interface"], default="GigabitEthernet0/1"),
                    "allowedVlans": self._first_existing(pd, ["allowedVlans", "allowed_vlans"], default="all"),
                    "nativeVlan": self._first_existing(pd, ["nativeVlan", "native_vlan"], default=None),
                    "rootGuard": bool(self._first_existing(pd, ["rootGuard", "root_guard"], default=False)),
                    "description": self._first_existing(pd, ["description"], default=None),
                }
            )

        # EtherChannels (supports new model keys)
        raw_ec = self._first_existing(s, ["etherChannels", "etherchannels", "ether_channels"], default=[]) or []
        ether_channels = []

        for ec in raw_ec:
            ecd = ec if isinstance(ec, dict) else self._dump(ec, by_alias=True)

            ec_id = self._first_existing(ecd, ["id", "channelGroup", "channel_group"], default=1)
            mode = self._first_existing(ecd, ["mode"], default=None)

            members_raw = self._first_existing(ecd, ["members"], default=[]) or []
            members: list[str] = []
            if isinstance(members_raw, list):
                for m in members_raw:
                    if isinstance(m, str):
                        members.append(m)
                    elif isinstance(m, dict) and "interface" in m:
                        members.append(m["interface"])
                    else:
                        md = self._dump(m, by_alias=True)
                        if isinstance(md, dict) and "interface" in md:
                            members.append(md["interface"])

            protocol = self._first_existing(ecd, ["protocol"], default=None)
            lacp_mode = self._first_existing(ecd, ["lacpMode"], default=None)
            pagp_mode = self._first_existing(ecd, ["pagpMode"], default=None)

            if not protocol:
                if mode in ["active", "passive"]:
                    protocol = "lacp"
                    lacp_mode = mode
                elif mode in ["desirable", "auto"]:
                    protocol = "pagp"
                    pagp_mode = mode
                else:
                    protocol = "on"

            channel_type = self._first_existing(ecd, ["channelType", "channel_type"], default="trunk")

            # Accept BOTH old + new field names
            access_vlan = self._first_existing(ecd, ["accessVlanId", "accessVlan", "access_vlan_id"], default=None)
            allowed = self._first_existing(ecd, ["allowedVlans", "trunkAllowedVlans", "allowed_vlans"], default=None)
            native = self._first_existing(ecd, ["nativeVlan", "trunkNativeVlan", "native_vlan"], default=None)

            ip = self._first_existing(ecd, ["ipAddress", "ip_address"], default=None)
            mask = self._first_existing(ecd, ["subnetMask", "subnet_mask"], default=None)
            desc = self._first_existing(ecd, ["description"], default=None)

            ether_channels.append(
                {
                    "id": int(ec_id),
                    "protocol": protocol,
                    "lacpMode": lacp_mode,
                    "pagpMode": pagp_mode,
                    "members": members,
                    "channelType": channel_type,
                    "accessVlanId": access_vlan,
                    "allowedVlans": allowed,
                    "nativeVlan": native,
                    "ipAddress": ip,
                    "subnetMask": mask,
                    "description": desc,
                }
            )

        return {
            "vlans": vlans,
            "stp": stp,
            "accessPorts": access_ports,
            "trunkPorts": trunk_ports,
            "etherChannels": ether_channels,
        }

    def _render_switching(self, switching: Any) -> str:
        try:
            template = self.env.get_template("switching.j2")
            ctx = self._normalize_switching_for_template(switching)
            return template.render(
                vlans=ctx["vlans"],
                stp=ctx["stp"],
                accessPorts=ctx["accessPorts"],
                trunkPorts=ctx["trunkPorts"],
                etherChannels=ctx["etherChannels"],
            ).strip()
        except Exception as e:
            logger.warning(f"Template error, using fallback: {e}")
            return self._fallback_switching(switching)

    def _fallback_switching(self, switching: Any) -> str:
        # Keep your existing fallback style (camelCase context)
        lines = []
        ctx = self._normalize_switching_for_template(switching)

        for vlan in ctx["vlans"]:
            lines.append(f"vlan {vlan['vlanId']}")
            lines.append(f" name {vlan['name']}")
            lines.append("!")

        if ctx["stp"]:
            stp = ctx["stp"]
            lines.append(f"spanning-tree mode {stp.get('mode', 'rapid-pvst')}")

            stp_vlans = "1-4094"
            if stp.get("vlanScope") == "custom" and stp.get("vlans"):
                stp_vlans = stp["vlans"]

            if stp.get("rootMode") == "primarySecondary":
                role = stp.get("rootRole", "primary")
                lines.append(f"spanning-tree vlan {stp_vlans} root {role}")
            else:
                prio = stp.get("priority")
                if prio is not None:
                    lines.append(f"spanning-tree vlan {stp_vlans} priority {prio}")
            lines.append("!")

        for port in ctx["accessPorts"]:
            lines.append(f"interface {port['interface']}")
            if port.get("description"):
                lines.append(f" description {port['description']}")
            lines.append(" switchport mode access")
            lines.append(f" switchport access vlan {port['vlanId']}")
            if port.get("portfast"):
                lines.append(" spanning-tree portfast")
            if port.get("bpduGuard"):
                lines.append(" spanning-tree bpduguard enable")
            lines.append("!")

        for port in ctx["trunkPorts"]:
            lines.append(f"interface {port['interface']}")
            if port.get("description"):
                lines.append(f" description {port['description']}")
            lines.append(" switchport trunk encapsulation dot1q")
            lines.append(" switchport mode trunk")
            if port.get("allowedVlans") and port["allowedVlans"] != "all":
                lines.append(f" switchport trunk allowed vlan {port['allowedVlans']}")
            if port.get("nativeVlan"):
                lines.append(f" switchport trunk native vlan {port['nativeVlan']}")
            if port.get("rootGuard"):
                lines.append(" spanning-tree guard root")
            lines.append("!")

        for ec in ctx["etherChannels"]:
            protocol = ec.get("protocol", "on")
            ch_mode = "on"
            if protocol == "lacp":
                ch_mode = ec.get("lacpMode") or "active"
            elif protocol == "pagp":
                ch_mode = ec.get("pagpMode") or "desirable"

            for member in ec.get("members", []) or []:
                lines.append(f"interface {member}")
                lines.append(f" channel-group {ec['id']} mode {ch_mode}")
                lines.append("!")

            lines.append(f"interface Port-channel{ec['id']}")
            if ec.get("description"):
                lines.append(f" description {ec['description']}")

            if ec.get("channelType") == "routed":
                lines.append(" no switchport")
                if ec.get("ipAddress") and ec.get("subnetMask"):
                    lines.append(f" ip address {ec['ipAddress']} {ec['subnetMask']}")
            elif ec.get("channelType") == "access":
                lines.append(" switchport")
                lines.append(" switchport mode access")
                lines.append(f" switchport access vlan {ec.get('accessVlanId') or 10}")
            else:
                lines.append(" switchport")
                lines.append(" switchport trunk encapsulation dot1q")
                lines.append(" switchport mode trunk")
                if ec.get("allowedVlans") and ec["allowedVlans"] != "all":
                    lines.append(f" switchport trunk allowed vlan {ec['allowedVlans']}")
                if ec.get("nativeVlan"):
                    lines.append(f" switchport trunk native vlan {ec['nativeVlan']}")
            lines.append("!")

        return "\n".join(lines)

    # ---------------- Routing ----------------

    def _render_routing(self, routing: Any) -> str:
        """Render routing using snake_case template keys."""
        try:
            template = self.env.get_template("routing.j2")
            r = self._dump(routing, by_alias=False) or {}

            return template.render(
                default_route=r.get("default_route"),
                static_routes=r.get("static_routes") or [],
                ospf=r.get("ospf"),
                eigrp=r.get("eigrp"),
                gre_tunnels=r.get("gre_tunnels") or [],
            ).strip()
        except Exception as e:
            logger.warning(f"Template error, using fallback: {e}")
            return self._fallback_routing(routing)

    def _fallback_routing(self, routing: Any) -> str:
        # keep your current fallback (supports alias keys)
        lines = []
        r = self._dump(routing, by_alias=True) or {}

        # Default route
        dr = r.get("defaultRoute") or r.get("default_route")
        if dr:
            nh = dr.get("nextHop") or dr.get("next_hop")
            ei = dr.get("exitInterface") or dr.get("exit_interface")
            dist = dr.get("distance")
            if nh:
                lines.append(f"ip route 0.0.0.0 0.0.0.0 {nh}{' ' + str(dist) if dist else ''}")
            elif ei:
                lines.append(f"ip route 0.0.0.0 0.0.0.0 {ei}{' ' + str(dist) if dist else ''}")
            lines.append("!")

        # Static routes
        for sr in r.get("staticRoutes") or r.get("static_routes") or []:
            dest = sr.get("destination")
            mask = sr.get("subnetMask") or sr.get("subnet_mask")
            nh = sr.get("nextHop") or sr.get("next_hop")
            ei = sr.get("exitInterface") or sr.get("exit_interface")
            dist = sr.get("distance")
            name = sr.get("name")

            if ei and nh:
                line = f"ip route {dest} {mask} {ei} {nh}"
            elif nh:
                line = f"ip route {dest} {mask} {nh}"
            elif ei:
                line = f"ip route {dest} {mask} {ei}"
            else:
                continue

            if dist:
                line += f" {dist}"
            if name:
                line += f" name {name}"
            lines.append(line)

        if (r.get("staticRoutes") or r.get("static_routes")):
            lines.append("!")

        # OSPF
        ospf = r.get("ospf")
        if ospf:
            process_id = ospf.get("processId") or ospf.get("process_id")
            router_id = ospf.get("routerId") or ospf.get("router_id")
            lines.append(f"router ospf {process_id}")
            if router_id:
                lines.append(f" router-id {router_id}")

            for network in ospf.get("networks", []) or []:
                lines.append(f" network {network['network']} {network['wildcard']} area {network['area']}")

            for passive in ospf.get("passiveInterfaces") or ospf.get("passive_interfaces") or []:
                lines.append(f" passive-interface {passive}")

            if ospf.get("defaultOriginate") or ospf.get("default_originate"):
                lines.append(" default-information originate")
            lines.append("!")

            for iface in ospf.get("interfaces", []) or []:
                lines.append(f"interface {iface['interface']}")
                lines.append(f" ip ospf {process_id} area {iface['area']}")
                if iface.get("cost"):
                    lines.append(f" ip ospf cost {iface['cost']}")
                if iface.get("priority") is not None:
                    lines.append(f" ip ospf priority {iface['priority']}")
                lines.append("!")

        # EIGRP (optional)
        eigrp = r.get("eigrp")
        if eigrp and eigrp.get("enabled"):
            asn = eigrp.get("asn", 100)
            rid = eigrp.get("routerId") or eigrp.get("router_id")
            lines.append(f"router eigrp {asn}")
            if rid:
                lines.append(f" eigrp router-id {rid}")
            if eigrp.get("noAutoSummary", True) or eigrp.get("no_auto_summary", True):
                lines.append(" no auto-summary")
            for net in eigrp.get("networks", []) or []:
                if net.get("wildcard"):
                    lines.append(f" network {net['network']} {net['wildcard']}")
                else:
                    lines.append(f" network {net['network']}")
            for passive in eigrp.get("passiveInterfaces") or eigrp.get("passive_interfaces") or []:
                lines.append(f" passive-interface {passive}")
            lines.append("!")

        # GRE tunnels
        for tunnel in r.get("greTunnels") or r.get("gre_tunnels") or []:
            tn = tunnel.get("tunnelNumber") or tunnel.get("tunnel_number")
            lines.append(f"interface Tunnel{tn}")
            lines.append(
                f" ip address {tunnel.get('tunnelIp') or tunnel.get('tunnel_ip')} "
                f"{tunnel.get('tunnelMask') or tunnel.get('tunnel_mask')}"
            )
            if tunnel.get("mtu"):
                lines.append(f" ip mtu {tunnel['mtu']}")
            if tunnel.get("adjustMss"):
                lines.append(f" ip tcp adjust-mss {tunnel['adjustMss']}")
            lines.append(f" tunnel source {tunnel.get('sourceInterface') or tunnel.get('source_interface')}")
            lines.append(f" tunnel destination {tunnel.get('destinationIp') or tunnel.get('destination_ip')}")
            lines.append(" tunnel mode gre ip")
            if tunnel.get("tunnelKey") is not None:
                lines.append(f" tunnel key {tunnel['tunnelKey']}")
            if tunnel.get("keepaliveSeconds"):
                if tunnel.get("keepaliveRetries"):
                    lines.append(f" keepalive {tunnel['keepaliveSeconds']} {tunnel['keepaliveRetries']}")
                else:
                    lines.append(f" keepalive {tunnel['keepaliveSeconds']}")
            lines.append("!")

        return "\n".join(lines)

    # ---------------- Security ----------------

    def _render_security(self, security: Any) -> str:
        """Render ACLs using snake_case template keys."""
        try:
            template = self.env.get_template("security.j2")
            s = self._dump(security, by_alias=False) or {}
            return template.render(
                standard_acls=s.get("standard_acls") or [],
                extended_acls=s.get("extended_acls") or [],
                acl_applications=s.get("acl_applications") or [],
            ).strip()
        except Exception as e:
            logger.warning(f"Template error, using fallback: {e}")
            return self._fallback_security(security)

    def _fallback_security(self, security: Any) -> str:
        # unchanged fallback (supports alias keys)
        lines = []
        s = self._dump(security, by_alias=True) or {}

        for acl in s.get("standardAcls") or s.get("standard_acls") or []:
            number = acl.get("number")
            for entry in acl.get("entries", []) or []:
                action = entry.get("action")
                source = entry.get("source")
                wildcard = entry.get("wildcard")
                if wildcard:
                    lines.append(f"access-list {number} {action} {source} {wildcard}")
                elif source == "any":
                    lines.append(f"access-list {number} {action} any")
                else:
                    lines.append(f"access-list {number} {action} host {source}")

        if (s.get("standardAcls") or s.get("standard_acls")):
            lines.append("!")

        for acl in s.get("extendedAcls") or s.get("extended_acls") or []:
            name = acl.get("numberOrName") or acl.get("number_or_name")
            is_named = not str(name).isdigit()
            if is_named:
                lines.append(f"ip access-list extended {name}")
                for entry in acl.get("entries", []) or []:
                    src = entry.get("source")
                    src_wc = entry.get("sourceWildcard") or entry.get("source_wildcard")
                    dst = entry.get("destination")
                    dst_wc = entry.get("destinationWildcard") or entry.get("destination_wildcard")
                    proto = entry.get("protocol")
                    port = entry.get("port")

                    src_str = f"{src} {src_wc}" if src_wc else src
                    dst_str = f"{dst} {dst_wc}" if dst_wc else dst
                    port_str = f" {port}" if port else ""
                    lines.append(f" {entry.get('action')} {proto} {src_str} {dst_str}{port_str}")
                lines.append("!")

        for app in s.get("aclApplications") or s.get("acl_applications") or []:
            lines.append(f"interface {app['interface']}")
            lines.append(f" ip access-group {app['acl']} {app['direction']}")
            lines.append("!")

        return "\n".join(lines)

    # ---------------- Services ----------------

    def _render_services(self, services: Any) -> str:
        """Render services using snake_case template keys."""
        try:
            template = self.env.get_template("services.j2")
            sv = self._dump(services, by_alias=False) or {}
            return template.render(
                dhcp_exclusions=sv.get("dhcp_exclusions") or [],
                dhcp_pools=sv.get("dhcp_pools") or [],
                hsrp_configs=sv.get("hsrp") or [],
                nat=sv.get("nat"),
            ).strip()
        except Exception as e:
            logger.warning(f"Template error, using fallback: {e}")
            return self._fallback_services(services)

    def _fallback_services(self, services: Any) -> str:
        # fallback supports alias keys; minimal fix: allow excl.end optional
        lines = []
        sv = self._dump(services, by_alias=True) or {}

        for excl in sv.get("dhcpExclusions") or sv.get("dhcp_exclusions") or []:
            if excl.get("end"):
                lines.append(f"ip dhcp excluded-address {excl['start']} {excl['end']}")
            else:
                lines.append(f"ip dhcp excluded-address {excl['start']}")

        if (sv.get("dhcpExclusions") or sv.get("dhcp_exclusions")):
            lines.append("!")

        for pool in sv.get("dhcpPools") or sv.get("dhcp_pools") or []:
            lines.append(f"ip dhcp pool {pool['name']}")
            lines.append(f" network {pool['network']} {pool['mask']}")
            if pool.get("defaultGateway"):
                lines.append(f" default-router {pool['defaultGateway']}")
            for dns in pool.get("dnsServers") or []:
                lines.append(f" dns-server {dns}")
            if pool.get("domainName"):
                lines.append(f" domain-name {pool['domainName']}")
            lines.append(f" lease {pool.get('leaseDays', 1)}")
            lines.append("!")

        for hsrp in sv.get("hsrp") or []:
            lines.append(f"interface {hsrp['interface']}")
            lines.append(f" standby {hsrp['group']} ip {hsrp['virtualIp']}")
            lines.append(f" standby {hsrp['group']} priority {hsrp.get('priority', 100)}")
            if hsrp.get("preempt", True):
                lines.append(f" standby {hsrp['group']} preempt")
            lines.append("!")

        nat = sv.get("nat")
        if nat:
            for iface in nat.get("insideInterfaces") or []:
                lines.append(f"interface {iface}")
                lines.append(" ip nat inside")
                lines.append("!")

            for iface in nat.get("outsideInterfaces") or []:
                lines.append(f"interface {iface}")
                lines.append(" ip nat outside")
                lines.append("!")

            for static in nat.get("staticEntries") or []:
                lines.append(f"ip nat inside source static {static['insideLocal']} {static['insideGlobal']}")

            for pool in nat.get("pools") or []:
                lines.append(f"ip nat pool {pool['name']} {pool['startIp']} {pool['endIp']} netmask {pool['netmask']}")

            if nat.get("patInterface") and nat.get("patAcl"):
                lines.append(f"ip nat inside source list {nat['patAcl']} interface {nat['patInterface']} overload")

            lines.append("!")

        return "\n".join(lines)

    # ---------------- Merge ----------------

    def _merge_config(self, per_module: Dict[str, str]) -> str:
        # Put base first so hostname/users/ssh appear early
        order = ["base", "switching", "addressing", "routing", "security", "services"]

        merged = [
            "! CCNA Network Configuration",
            "! Generated by Config Generator",
            "!",
        ]

        for module in order:
            if module in per_module and per_module[module]:
                merged.append(per_module[module])
                merged.append("!")

        merged.append("end")
        return "\n".join(merged)
