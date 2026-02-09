"""Configuration validation rules.

The goal is to provide user-friendly validation errors for the UI,
while keeping the backend resilient to partial configs.
"""

import ipaddress
from typing import List, Dict, Any

from .models import IntendedConfig


class ValidationResult:
    """Validation result container"""

    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[str] = []

    def add_error(self, field: str, message: str):
        self.errors.append({"field": field, "message": message})

    def add_warning(self, message: str):
        self.warnings.append(message)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def validate_ip_address(ip: str) -> bool:
    """Validate IP address format."""
    try:
        ipaddress.ip_address(ip)
        return True
    except Exception:
        return False


def validate_subnet_mask(mask: str) -> bool:
    """Validate subnet mask (dotted decimal)."""
    try:
        octets = [int(o) for o in mask.split(".")]
        if len(octets) != 4:
            return False
        if any(o < 0 or o > 255 for o in octets):
            return False

        binary = "".join(format(o, "08b") for o in octets)
        # Valid mask: contiguous 1s then 0s; reject any 01 transition
        return "01" not in binary and ("1" in binary or binary == "0" * 32)
    except Exception:
        return False


def validate_wildcard_mask(wildcard: str) -> bool:
    """Validate OSPF/EIGRP wildcard mask (dotted decimal). Light validation."""
    try:
        octets = [int(o) for o in wildcard.split(".")]
        if len(octets) != 4:
            return False
        if any(o < 0 or o > 255 for o in octets):
            return False
        return True
    except Exception:
        return False


def is_network_address(ip: str, mask: str) -> bool:
    """Check if IP is the network address.
    
    Exception: /32 masks (255.255.255.255) are always valid for loopbacks/point-to-point.
    """
    try:
        # /32 masks are special - the IP IS the network address (loopbacks, point-to-point)
        if mask == "255.255.255.255":
            return False
        
        network = ipaddress.ip_network(f"{ip}/{mask}", strict=False)
        return str(network.network_address) == ip
    except Exception:
        return False


def is_broadcast_address(ip: str, mask: str) -> bool:
    """Check if IP is the broadcast address.
    
    Exception: /32 masks (255.255.255.255) don't have a separate broadcast address.
    """
    try:
        # /32 masks don't have a separate broadcast address
        if mask == "255.255.255.255":
            return False
        
        network = ipaddress.ip_network(f"{ip}/{mask}", strict=False)
        return str(network.broadcast_address) == ip
    except Exception:
        return False


def validate_vlan_id(vlan_id: int) -> bool:
    return 1 <= vlan_id <= 4094


def validate_allowed_vlans_string(value: str) -> bool:
    """Validate trunk allowed VLAN string."""
    if not isinstance(value, str):
        return False

    v = value.strip().lower()
    if v == "all":
        return True
    if v == "":
        return False

    parts = [p.strip() for p in v.split(",")]
    if any(p == "" for p in parts):
        return False

    for part in parts:
        if "-" in part:
            rng = [x.strip() for x in part.split("-")]
            if len(rng) != 2:
                return False
            if not rng[0].isdigit() or not rng[1].isdigit():
                return False
            start = int(rng[0])
            end = int(rng[1])
            if start > end:
                return False
            if not (validate_vlan_id(start) and validate_vlan_id(end)):
                return False
        else:
            if not part.isdigit():
                return False
            vid = int(part)
            if not validate_vlan_id(vid):
                return False

    return True


def _track_ip_conflict(
    result: ValidationResult,
    assigned_ips: Dict[str, str],
    ip: str,
    label: str,
    field: str,
):
    """Track IP conflicts across the entire intended config."""
    if ip in assigned_ips:
        result.add_error(
            field,
            f"IP conflict: {ip} already assigned to {assigned_ips[ip]}",
        )
    else:
        assigned_ips[ip] = label


def validate_config(config: IntendedConfig) -> ValidationResult:
    """Validate complete configuration."""
    result = ValidationResult()
    assigned_ips: Dict[str, str] = {}

    # --------------------------
    # Addressing validation
    # --------------------------
    if config.addressing:
        # Management SVI (optional)
        mgmt = getattr(config.addressing, "management", None)
        if mgmt and mgmt.ip_address:
            if not validate_ip_address(mgmt.ip_address):
                result.add_error("addressing.management.ipAddress", f"Invalid IP address: {mgmt.ip_address}")
            if mgmt.subnet_mask and not validate_subnet_mask(mgmt.subnet_mask):
                result.add_error("addressing.management.subnetMask", f"Invalid subnet mask: {mgmt.subnet_mask}")

            if mgmt.ip_address and mgmt.subnet_mask and validate_ip_address(mgmt.ip_address) and validate_subnet_mask(mgmt.subnet_mask):
                if is_network_address(mgmt.ip_address, mgmt.subnet_mask):
                    result.add_error("addressing.management.ipAddress", f"Cannot use network address: {mgmt.ip_address}")
                if is_broadcast_address(mgmt.ip_address, mgmt.subnet_mask):
                    result.add_error("addressing.management.ipAddress", f"Cannot use broadcast address: {mgmt.ip_address}")
                _track_ip_conflict(
                    result,
                    assigned_ips,
                    mgmt.ip_address,
                    "management SVI",
                    "addressing.management.ipAddress",
                )

            if mgmt.default_gateway and not validate_ip_address(mgmt.default_gateway):
                result.add_error("addressing.management.defaultGateway", f"Invalid default gateway: {mgmt.default_gateway}")

        # Routed interfaces (routers / MSW)
        for iface in config.addressing.interfaces:
            ip = iface.ip_address
            mask = iface.subnet_mask
            field_prefix = f"addressing.interfaces.{iface.interface}"

            if not validate_ip_address(ip):
                result.add_error(field_prefix, f"Invalid IP address: {ip}")
                continue
            if not validate_subnet_mask(mask):
                result.add_error(field_prefix, f"Invalid subnet mask: {mask}")
                continue

            if is_network_address(ip, mask):
                result.add_error(field_prefix, f"Cannot use network address: {ip}")
            if is_broadcast_address(ip, mask):
                result.add_error(field_prefix, f"Cannot use broadcast address: {ip}")

            _track_ip_conflict(result, assigned_ips, ip, iface.interface, field_prefix)

        # VLAN SVIs (MSW)
        vlan_ifaces = getattr(config.addressing, "vlan_interfaces", None)
        if vlan_ifaces:
            for svi in vlan_ifaces:
                field_prefix = f"addressing.vlanInterfaces.vlan{svi.vlan_id}"
                if not validate_vlan_id(svi.vlan_id):
                    result.add_error(field_prefix, f"VLAN ID must be between 1 and 4094 (got {svi.vlan_id})")

                if not validate_ip_address(svi.ip_address):
                    result.add_error(field_prefix, f"Invalid IP address: {svi.ip_address}")
                    continue
                if not validate_subnet_mask(svi.subnet_mask):
                    result.add_error(field_prefix, f"Invalid subnet mask: {svi.subnet_mask}")
                    continue

                if is_network_address(svi.ip_address, svi.subnet_mask):
                    result.add_error(field_prefix, f"Cannot use network address: {svi.ip_address}")
                if is_broadcast_address(svi.ip_address, svi.subnet_mask):
                    result.add_error(field_prefix, f"Cannot use broadcast address: {svi.ip_address}")

                _track_ip_conflict(
                    result,
                    assigned_ips,
                    svi.ip_address,
                    f"Vlan{svi.vlan_id}",
                    field_prefix,
                )

        # Subinterfaces (router-on-a-stick)
        for sub in config.addressing.subinterfaces:
            field_prefix = f"addressing.subinterfaces.{sub.parent_interface}.{sub.vlan_id}"

            if not validate_vlan_id(sub.vlan_id):
                result.add_error(field_prefix, f"VLAN ID must be between 1 and 4094 (got {sub.vlan_id})")

            if not validate_ip_address(sub.ip_address):
                result.add_error(field_prefix, f"Invalid IP address: {sub.ip_address}")
                continue

            if not validate_subnet_mask(sub.subnet_mask):
                result.add_error(field_prefix, f"Invalid subnet mask: {sub.subnet_mask}")
                continue

            if is_network_address(sub.ip_address, sub.subnet_mask):
                result.add_error(field_prefix, f"Cannot use network address: {sub.ip_address}")
            if is_broadcast_address(sub.ip_address, sub.subnet_mask):
                result.add_error(field_prefix, f"Cannot use broadcast address: {sub.ip_address}")

            label = f"{sub.parent_interface}.{sub.vlan_id}"
            _track_ip_conflict(result, assigned_ips, sub.ip_address, label, field_prefix)

    # --------------------------
    # Switching validation
    # --------------------------
    if config.switching:
        # Duplicate VLANs
        vlan_ids = [v.vlan_id for v in config.switching.vlans]
        if len(vlan_ids) != len(set(vlan_ids)):
            result.add_error("switching.vlans", "Duplicate VLAN IDs detected")

        # VLAN range warnings/errors
        for vlan in config.switching.vlans:
            if not validate_vlan_id(vlan.vlan_id):
                result.add_error(f"switching.vlans.{vlan.vlan_id}", "VLAN ID must be between 1 and 4094")
            if vlan.vlan_id in [1002, 1003, 1004, 1005]:
                result.add_warning(f"VLAN {vlan.vlan_id} is reserved for legacy protocols")

        # Trunk ports allowed VLANs + native VLAN
        for trunk in config.switching.trunk_ports:
            if trunk.allowed_vlans and not validate_allowed_vlans_string(trunk.allowed_vlans):
                result.add_error(
                    f"switching.trunkPorts.{trunk.interface}.allowedVlans",
                    f"Invalid allowed VLAN list: {trunk.allowed_vlans}",
                )
            if trunk.native_vlan is not None and not validate_vlan_id(trunk.native_vlan):
                result.add_error(
                    f"switching.trunkPorts.{trunk.interface}.nativeVlan",
                    f"Native VLAN must be between 1 and 4094 (got {trunk.native_vlan})",
                )

        # EtherChannel sanity (members count, VLAN lists)
        for ec in config.switching.etherchannels:
            ec_id = getattr(ec, "id", None)
            ec_label = f"Port-channel{ec_id}" if ec_id is not None else "Port-channel"

            if len(ec.members) < 2:
                result.add_warning(f"{ec_label} has fewer than 2 members (EtherChannel usually needs >=2).")
            if len(ec.members) > 8:
                result.add_error(
                    f"switching.etherchannels.{ec_id or 'unknown'}",
                    "EtherChannel cannot have more than 8 members",
                )

            trunk_allowed = getattr(ec, "trunk_allowed_vlans", None)
            if trunk_allowed and not validate_allowed_vlans_string(trunk_allowed):
                result.add_error(
                    f"switching.etherchannels.{ec_id or 'unknown'}.trunkAllowedVlans",
                    f"Invalid allowed VLAN list: {trunk_allowed}",
                )

            trunk_native = getattr(ec, "trunk_native_vlan", None)
            if trunk_native is not None and not validate_vlan_id(trunk_native):
                result.add_error(
                    f"switching.etherchannels.{ec_id or 'unknown'}.trunkNativeVlan",
                    f"Native VLAN must be between 1 and 4094 (got {trunk_native})",
                )

    # --------------------------
    # Routing validation
    # --------------------------
    if config.routing:
        # Default route
        if config.routing.default_route:
            dr = config.routing.default_route
            if not dr.next_hop and not dr.exit_interface:
                result.add_error("routing.defaultRoute", "Default route requires nextHop or exitInterface")
            if dr.next_hop and not validate_ip_address(dr.next_hop):
                result.add_error("routing.defaultRoute.nextHop", f"Invalid nextHop IP: {dr.next_hop}")
            if dr.distance is not None and not (1 <= dr.distance <= 255):
                result.add_error("routing.defaultRoute.distance", "Administrative distance must be 1-255")

        # Static routes
        for idx, sr in enumerate(config.routing.static_routes):
            base = f"routing.staticRoutes[{idx}]"

            if not validate_ip_address(sr.destination):
                result.add_error(f"{base}.destination", f"Invalid destination IP: {sr.destination}")

            if not validate_subnet_mask(sr.subnet_mask):
                result.add_error(f"{base}.subnetMask", f"Invalid subnet mask: {sr.subnet_mask}")

            if not sr.next_hop and not sr.exit_interface:
                result.add_error(base, "Static route requires nextHop or exitInterface")

            if sr.next_hop and not validate_ip_address(sr.next_hop):
                result.add_error(f"{base}.nextHop", f"Invalid nextHop IP: {sr.next_hop}")

            if sr.distance is not None and not (1 <= sr.distance <= 255):
                result.add_error(f"{base}.distance", "Administrative distance must be 1-255")

        # OSPF
        if config.routing.ospf:
            ospf = config.routing.ospf

            if ospf.router_id and not validate_ip_address(ospf.router_id):
                result.add_error("routing.ospf.routerId", f"Invalid router ID: {ospf.router_id}")

            if ospf.process_id < 1 or ospf.process_id > 65535:
                result.add_error("routing.ospf.processId", "OSPF process ID must be 1-65535")

            if not ospf.networks and not ospf.interfaces:
                result.add_warning("OSPF enabled but no networks/interfaces were configured.")

            for i, net in enumerate(ospf.networks):
                if not validate_ip_address(net.network):
                    result.add_error(f"routing.ospf.networks[{i}].network", f"Invalid network IP: {net.network}")
                if not validate_wildcard_mask(net.wildcard):
                    result.add_error(f"routing.ospf.networks[{i}].wildcard", f"Invalid wildcard mask: {net.wildcard}")
                if net.area < 0 or net.area > 4294967295:
                    result.add_error(f"routing.ospf.networks[{i}].area", "OSPF area must be >=0")

            for i, iface in enumerate(ospf.interfaces):
                if iface.area < 0 or iface.area > 4294967295:
                    result.add_error(f"routing.ospf.interfaces[{i}].area", "OSPF area must be >=0")
                if iface.cost is not None and iface.cost < 1:
                    result.add_error(f"routing.ospf.interfaces[{i}].cost", "OSPF cost must be >=1")

        # EIGRP (optional)
        if config.routing.eigrp and config.routing.eigrp.enabled:
            eigrp = config.routing.eigrp
            if eigrp.asn < 1 or eigrp.asn > 65535:
                result.add_error("routing.eigrp.asn", "EIGRP ASN must be 1-65535")
            if eigrp.router_id and not validate_ip_address(eigrp.router_id):
                result.add_error("routing.eigrp.routerId", f"Invalid router ID: {eigrp.router_id}")
            if not eigrp.networks:
                result.add_warning("EIGRP enabled but no networks were configured.")
            for i, net in enumerate(eigrp.networks):
                if not validate_ip_address(net.network):
                    result.add_error(f"routing.eigrp.networks[{i}].network", f"Invalid network IP: {net.network}")
                if net.wildcard and not validate_wildcard_mask(net.wildcard):
                    result.add_error(f"routing.eigrp.networks[{i}].wildcard", f"Invalid wildcard mask: {net.wildcard}")

        # GRE tunnels
        for i, tun in enumerate(config.routing.gre_tunnels):
            base = f"routing.greTunnels[{i}]"
            if not validate_ip_address(tun.destination_ip):
                result.add_error(f"{base}.destinationIp", f"Invalid destination IP: {tun.destination_ip}")
            if not validate_ip_address(tun.tunnel_ip):
                result.add_error(f"{base}.tunnelIp", f"Invalid tunnel IP: {tun.tunnel_ip}")
            if not validate_subnet_mask(tun.tunnel_mask):
                result.add_error(f"{base}.tunnelMask", f"Invalid tunnel mask: {tun.tunnel_mask}")

            if tun.keepalive_seconds is not None and tun.keepalive_seconds <= 0:
                result.add_error(f"{base}.keepaliveSeconds", "Keepalive seconds must be > 0")
            if tun.keepalive_retries is not None and tun.keepalive_retries <= 0:
                result.add_error(f"{base}.keepaliveRetries", "Keepalive retries must be > 0")
            if tun.mtu is not None and (tun.mtu < 576 or tun.mtu > 9000):
                result.add_warning(f"{base}: MTU {tun.mtu} looks unusual (expected 576-9000).")
            if tun.adjust_mss is not None and (tun.adjust_mss < 500 or tun.adjust_mss > 1460):
                result.add_warning(f"{base}: adjust-mss {tun.adjust_mss} looks unusual (expected ~500-1460).")

        # Route Redistribution
        if config.routing.redistribute_enabled:
            ospf_enabled = config.routing.ospf and config.routing.ospf.process_id
            eigrp_enabled = config.routing.eigrp and config.routing.eigrp.enabled

            if not (ospf_enabled and eigrp_enabled):
                result.add_warning(
                    "Redistribution enabled but requires both OSPF and EIGRP. "
                    "Redistribution commands will be skipped."
                )

            # Warn if custom metric is malformed
            if config.routing.redistribute_metric:
                parts = config.routing.redistribute_metric.split()
                if len(parts) != 5:
                    result.add_warning(
                        f"EIGRP metric should have 5 values (bandwidth delay reliability load mtu). "
                        f"Got: {config.routing.redistribute_metric}. Default metric will be used instead."
                    )

    # --------------------------
    # Services validation
    # --------------------------
    if config.services:
        # HSRP
        for hsrp in config.services.hsrp:
            if not validate_ip_address(hsrp.virtual_ip):
                result.add_error(
                    f"services.hsrp.{hsrp.interface}",
                    f"Invalid virtual IP: {hsrp.virtual_ip}",
                )
            if hsrp.priority < 0 or hsrp.priority > 255:
                result.add_error(
                    f"services.hsrp.{hsrp.interface}",
                    "HSRP priority must be 0-255",
                )

        # DHCP pools
        for pool in config.services.dhcp_pools:
            base = f"services.dhcpPools.{pool.name}"

            if not validate_ip_address(pool.network):
                result.add_error(base, f"Invalid network address: {pool.network}")

            if not validate_subnet_mask(pool.mask):
                result.add_error(f"{base}.mask", f"Invalid subnet mask: {pool.mask}")

            if pool.default_gateway and not validate_ip_address(pool.default_gateway):
                result.add_error(f"{base}.defaultGateway", f"Invalid default gateway: {pool.default_gateway}")

            for dns in pool.dns_servers:
                if not validate_ip_address(dns):
                    result.add_error(f"{base}.dnsServers", f"Invalid DNS server IP: {dns}")

            if validate_ip_address(pool.network) and validate_subnet_mask(pool.mask):
                if not is_network_address(pool.network, pool.mask):
                    result.add_warning(f"{base}: network {pool.network}/{pool.mask} is not a network address (check your pool).")

        # DHCP exclusions
        for idx, ex in enumerate(config.services.dhcp_exclusions):
            base = f"services.dhcpExclusions[{idx}]"
            if not validate_ip_address(ex.start):
                result.add_error(f"{base}.start", f"Invalid exclusion start IP: {ex.start}")
            if ex.end and not validate_ip_address(ex.end):
                result.add_error(f"{base}.end", f"Invalid exclusion end IP: {ex.end}")

        # NAT sanity
        nat = config.services.nat
        if nat:
            any_nat_rules = bool(nat.static_entries or nat.pools or nat.pat_interface or nat.pat_acl)
            if any_nat_rules:
                if not nat.inside_interfaces:
                    result.add_error("services.nat.insideInterfaces", "NAT configured but no insideInterfaces were set.")
                if not nat.outside_interfaces:
                    result.add_error("services.nat.outsideInterfaces", "NAT configured but no outsideInterfaces were set.")

            if nat.pat_interface and not nat.pat_acl:
                result.add_warning("PAT is configured but patAcl is missing. You probably want an ACL for overload traffic.")

            for idx, st in enumerate(nat.static_entries):
                base = f"services.nat.staticEntries[{idx}]"
                if not validate_ip_address(st.inside_local):
                    result.add_error(f"{base}.insideLocal", f"Invalid insideLocal IP: {st.inside_local}")
                if not validate_ip_address(st.inside_global):
                    result.add_error(f"{base}.insideGlobal", f"Invalid insideGlobal IP: {st.inside_global}")

            for idx, pool in enumerate(nat.pools):
                base = f"services.nat.pools[{idx}]"
                if not validate_ip_address(pool.start_ip):
                    result.add_error(f"{base}.startIp", f"Invalid pool start IP: {pool.start_ip}")
                if not validate_ip_address(pool.end_ip):
                    result.add_error(f"{base}.endIp", f"Invalid pool end IP: {pool.end_ip}")
                if not validate_subnet_mask(pool.netmask):
                    result.add_error(f"{base}.netmask", f"Invalid pool netmask: {pool.netmask}")

    # --------------------------
    # Security validation (device access / SSH)
    # --------------------------
    if config.security and config.security.device_access:
        da = config.security.device_access

        if not da.enable_secret:
            result.add_warning("No enable secret configured (recommended for CCNA-style hardening).")

        if da.ssh and da.ssh.enabled:
            ssh = da.ssh

            if not ssh.domain_name or ssh.domain_name.strip() == "":
                result.add_error("security.deviceAccess.ssh.domainName", "SSH enabled but domainName is empty.")

            if ssh.rsa_modulus < 768 or ssh.rsa_modulus > 4096:
                result.add_warning("RSA modulus is unusual (common values: 1024 or 2048).")

            if ssh.version not in (1, 2):
                result.add_error("security.deviceAccess.ssh.version", "SSH version must be 1 or 2 (recommended 2).")

            if ssh.vty_start < 0 or ssh.vty_end < 0 or ssh.vty_start > ssh.vty_end or ssh.vty_end > 15:
                result.add_error("security.deviceAccess.ssh.vtyRange", "VTY range must be within 0-15 and start<=end.")

            if not da.users:
                result.add_warning("SSH/login local enabled but no local users are configured.")

    return result