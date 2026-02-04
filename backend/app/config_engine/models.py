"""Configuration engine Pydantic models (UI-aligned + backward compatible).

These models are designed to:
 - Accept camelCase payloads from the Next.js UI (via aliases)
 - Keep pythonic snake_case field names for templates/logic
 - Ignore unknown fields from the UI (extra='ignore')

NOTE: Templates in this project are written against snake_case field names.
"""

from __future__ import annotations

from typing import List, Optional, Literal, Union
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# NEW ADVANCED MODELS (VRF, IPSEC, BGP)
# -----------------------------------------------------------------------------

class VRFConfig(BaseModel):
    name: str
    rd: str  # Route Distinguisher (e.g., "100:1")
    route_target_export: Optional[str] = Field(None, alias="routeTargetExport")
    route_target_import: Optional[str] = Field(None, alias="routeTargetImport")
    description: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"

class BGPNeighbor(BaseModel):
    ip: str
    remote_as: int = Field(..., alias="remoteAs")
    update_source: Optional[str] = Field(None, alias="updateSource")
    next_hop_self: bool = Field(False, alias="nextHopSelf")
    activate_vpnv4: bool = Field(False, alias="activateVpnv4") # For MPLS/VPN

    class Config:
        populate_by_name = True
        extra = "ignore"

class BGPConfig(BaseModel):
    asn: int
    router_id: Optional[str] = Field(None, alias="routerId")
    neighbors: List[BGPNeighbor] = Field(default_factory=list)
    networks: List[str] = Field(default_factory=list) # List of advertised networks

    class Config:
        populate_by_name = True
        extra = "ignore"

class IPsecPhase1(BaseModel):
    policy_id: int = Field(10, alias="policyId")
    encryption: Literal['aes', '3des', 'des'] = 'aes'
    hash: Literal['sha', 'md5', 'sha256'] = 'sha'
    authentication: Literal['pre-share', 'rsa-encr'] = 'pre-share'
    group: int = 2
    lifetime: int = 86400
    key: str = "cisco123"

    class Config:
        populate_by_name = True
        extra = "ignore"

class IPsecPhase2(BaseModel):
    name: str = "TRANSFORM_SET"
    protocol: str = "esp-aes" # e.g. esp-aes esp-sha-hmac
    mode: Literal['tunnel', 'transport'] = 'tunnel'

    class Config:
        populate_by_name = True
        extra = "ignore"

class IPsecMap(BaseModel):
    name: str
    priority: int = 10
    peer_ip: str = Field(..., alias="peerIp")
    transform_set: str = Field(..., alias="transformSet")
    match_acl: str = Field(..., alias="matchAcl")

    class Config:
        populate_by_name = True
        extra = "ignore"


# ============== Addressing Models ==============

class ManagementSvi(BaseModel):
    """Switch management SVI (L2/MSW)."""

    vlan_id: int = Field(99, alias="vlanId")
    ip_address: str = Field("", alias="ipAddress")
    subnet_mask: str = Field("255.255.255.0", alias="subnetMask")
    # L2 only
    default_gateway: Optional[str] = Field(None, alias="defaultGateway")
    # MSW only
    default_route_next_hop: Optional[str] = Field(None, alias="defaultRouteNextHop")

    class Config:
        populate_by_name = True
        extra = "ignore"


class VlanInterfaceAddress(BaseModel):
    """SVI IP address configuration for VLAN interfaces (optional)."""

    vlan_id: int = Field(..., alias="vlanId")
    ip_address: str = Field(..., alias="ipAddress")
    subnet_mask: str = Field(..., alias="subnetMask")
    description: Optional[str] = None
    shutdown: bool = False
    
    # New features
    vrf: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class InterfaceAddress(BaseModel):
    """Interface IP address configuration."""

    interface: str
    ip_address: str = Field(..., alias="ipAddress")
    subnet_mask: str = Field(..., alias="subnetMask")
    description: Optional[str] = None
    shutdown: bool = False
    
    # New features for WAN/VPN/MPLS
    vrf: Optional[str] = None 
    crypto_map: Optional[str] = Field(None, alias="cryptoMap")
    mpls_ip: bool = Field(False, alias="mplsIp")  # NEW: Enable MPLS on interface

    class Config:
        populate_by_name = True
        extra = "ignore"


class Subinterface(BaseModel):
    """802.1Q subinterface configuration."""

    parent_interface: str = Field(..., alias="parentInterface")
    vlan_id: int = Field(..., alias="vlanId")
    ip_address: str = Field(..., alias="ipAddress")
    subnet_mask: str = Field(..., alias="subnetMask")
    description: Optional[str] = None
    
    # New features
    vrf: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class AddressingConfig(BaseModel):
    """Addressing configuration container."""

    management: Optional[ManagementSvi] = None
    vlan_interfaces: List[VlanInterfaceAddress] = Field(default_factory=list, alias="vlanInterfaces")
    interfaces: List[InterfaceAddress] = Field(default_factory=list)
    subinterfaces: List[Subinterface] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        extra = "ignore"


# ============== Switching Models (UI-aligned) ==============


SwitchType = Literal["l2", "msw"]

StpMode = Literal["pvst", "rapid-pvst"]
StpVlanScope = Literal["all", "custom"]
StpRootMode = Literal["primarySecondary", "manualPriority"]
StpRootRole = Literal["primary", "secondary"]

EtherProtocol = Literal["lacp", "pagp", "on"]
EtherChannelType = Literal["access", "trunk", "routed"]


class Vlan(BaseModel):
    vlan_id: int = Field(..., alias="vlanId")
    name: str

    class Config:
        populate_by_name = True
        extra = "ignore"


class AccessPort(BaseModel):
    interface: str
    vlan_id: int = Field(..., alias="vlanId")
    portfast: bool = True
    bpdu_guard: bool = Field(True, alias="bpduGuard")
    description: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class TrunkPort(BaseModel):
    interface: str
    allowed_vlans: str = Field("all", alias="allowedVlans")
    native_vlan: Optional[int] = Field(None, alias="nativeVlan")
    root_guard: bool = Field(False, alias="rootGuard")
    description: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class StpRoot(BaseModel):
    vlan_scope: StpVlanScope = Field("all", alias="vlanScope")
    mode: StpRootMode
    role: StpRootRole = "primary"
    vlans: str = "1-4094"  # Used if vlanScope=custom
    priority: Optional[int] = None  # Used if mode=manualPriority

    class Config:
        populate_by_name = True
        extra = "ignore"


class EtherChannelMember(BaseModel):
    interface: str
    mode: Optional[str] = None
    description: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class EtherChannel(BaseModel):
    id: int  # Port-channel number
    protocol: EtherProtocol = "lacp"

    channel_type: EtherChannelType = Field("trunk", alias="channelType")
    access_vlan: Optional[int] = Field(None, alias="accessVlan")

    trunk_allowed_vlans: str = Field("all", alias="trunkAllowedVlans")
    trunk_native_vlan: Optional[int] = Field(None, alias="trunkNativeVlan")

    members: List[EtherChannelMember] = Field(default_factory=list)

    # Routed mode
    ip_address: Optional[str] = Field(None, alias="ipAddress")
    subnet_mask: Optional[str] = Field(None, alias="subnetMask")

    description: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class SwitchingConfig(BaseModel):
    vlans: List[Vlan] = Field(default_factory=list)

    stp_mode: StpMode = Field("rapid-pvst", alias="stpMode")
    stp_roots: List[StpRoot] = Field(default_factory=list, alias="stpRoots")

    access_ports: List[AccessPort] = Field(default_factory=list, alias="accessPorts")
    trunk_ports: List[TrunkPort] = Field(default_factory=list, alias="trunkPorts")

    etherchannels: List[EtherChannel] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        extra = "ignore"


# ============== Routing Models ==============


class StaticRoute(BaseModel):
    destination: str
    subnet_mask: str = Field(..., alias="subnetMask")
    next_hop: Optional[str] = Field(None, alias="nextHop")
    exit_interface: Optional[str] = Field(None, alias="exitInterface")
    distance: Optional[int] = None
    name: Optional[str] = None
    vrf: Optional[str] = None # Added support for VRF static routes

    class Config:
        populate_by_name = True
        extra = "ignore"


class DefaultRoute(BaseModel):
    next_hop: Optional[str] = Field(None, alias="nextHop")
    exit_interface: Optional[str] = Field(None, alias="exitInterface")
    distance: Optional[int] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class OspfNetwork(BaseModel):
    network: str
    wildcard: str
    area: int

    class Config:
        populate_by_name = True
        extra = "ignore"


class OspfInterface(BaseModel):
    interface: str
    area: int
    cost: Optional[int] = None
    priority: Optional[int] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class OspfConfig(BaseModel):
    process_id: int = Field(..., alias="processId")
    router_id: Optional[str] = Field(None, alias="routerId")
    networks: List[OspfNetwork] = Field(default_factory=list)
    interfaces: List[OspfInterface] = Field(default_factory=list)
    passive_interfaces: List[str] = Field(default_factory=list, alias="passiveInterfaces")
    default_originate: bool = Field(False, alias="defaultOriginate")
    
    # If using VRF-lite OSPF
    vrf: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class EigrpNetwork(BaseModel):
    network: str
    wildcard: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class EigrpConfig(BaseModel):
    enabled: bool = False
    asn: int = 100
    router_id: Optional[str] = Field(None, alias="routerId")
    networks: List[EigrpNetwork] = Field(default_factory=list)
    passive_interfaces: List[str] = Field(default_factory=list, alias="passiveInterfaces")
    no_auto_summary: bool = Field(True, alias="noAutoSummary")

    class Config:
        populate_by_name = True
        extra = "ignore"


class GreTunnel(BaseModel):
    tunnel_number: int = Field(..., alias="tunnelNumber")
    source_interface: str = Field(..., alias="sourceInterface")
    destination_ip: str = Field(..., alias="destinationIp")
    tunnel_ip: str = Field(..., alias="tunnelIp")
    tunnel_mask: str = Field(..., alias="tunnelMask")

    tunnel_key: Optional[int] = Field(None, alias="tunnelKey")
    keepalive_seconds: Optional[int] = Field(None, alias="keepaliveSeconds")
    keepalive_retries: Optional[int] = Field(None, alias="keepaliveRetries")
    mtu: Optional[int] = None
    adjust_mss: Optional[int] = Field(None, alias="adjustMss")
    
    # New: IPsec protection for this tunnel
    ipsec_profile: Optional[str] = Field(None, alias="ipsecProfile")

    class Config:
        populate_by_name = True
        extra = "ignore"


class RoutingConfig(BaseModel):
    default_route: Optional[DefaultRoute] = Field(None, alias="defaultRoute")
    static_routes: List[StaticRoute] = Field(default_factory=list, alias="staticRoutes")
    ospf: Optional[OspfConfig] = None
    eigrp: Optional[EigrpConfig] = None
    gre_tunnels: List[GreTunnel] = Field(default_factory=list, alias="greTunnels")
    
    # New Advanced Routing
    bgp: Optional[BGPConfig] = None
    vrfs: List[VRFConfig] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        extra = "ignore"


# ============== Security Models ==============


class LocalUser(BaseModel):
    username: str
    privilege: Optional[int] = 1
    secret: Optional[str] = None
    password: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class SshConfig(BaseModel):
    enabled: bool = True
    domain_name: str = Field("localdomain", alias="domainName")
    rsa_modulus: int = Field(2048, alias="rsaModulus")
    version: int = 2
    vty_start: int = Field(0, alias="vtyStart")
    vty_end: int = Field(4, alias="vtyEnd")
    allow_telnet: bool = Field(False, alias="allowTelnet")
    exec_timeout_min: int = Field(10, alias="execTimeoutMin")
    exec_timeout_sec: int = Field(0, alias="execTimeoutSec")

    class Config:
        populate_by_name = True
        extra = "ignore"


class DeviceAccessConfig(BaseModel):
    enable_secret: Optional[str] = Field(None, alias="enableSecret")
    service_password_encryption: bool = Field(False, alias="servicePasswordEncryption")
    users: List[LocalUser] = Field(default_factory=list)
    ssh: Optional[SshConfig] = None
    banner_motd: Optional[str] = Field(None, alias="bannerMotd")

    class Config:
        populate_by_name = True
        extra = "ignore"


class StandardAclEntry(BaseModel):
    action: str
    source: str
    wildcard: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class StandardAcl(BaseModel):
    number: int
    entries: List[StandardAclEntry] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        extra = "ignore"


class ExtendedAclEntry(BaseModel):
    action: str
    protocol: str
    source: str
    source_wildcard: Optional[str] = Field(None, alias="sourceWildcard")
    destination: str
    destination_wildcard: Optional[str] = Field(None, alias="destinationWildcard")
    port: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


class ExtendedAcl(BaseModel):
    number_or_name: str = Field(..., alias="numberOrName")
    entries: List[ExtendedAclEntry] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        extra = "ignore"


class AclApplication(BaseModel):
    interface: str
    acl: str
    direction: str  # in/out

    class Config:
        populate_by_name = True
        extra = "ignore"


class SecurityConfig(BaseModel):
    device_access: Optional[DeviceAccessConfig] = Field(None, alias="deviceAccess")
    standard_acls: List[StandardAcl] = Field(default_factory=list, alias="standardAcls")
    extended_acls: List[ExtendedAcl] = Field(default_factory=list, alias="extendedAcls")
    acl_applications: List[AclApplication] = Field(default_factory=list, alias="aclApplications")
    
    # New IPsec VPN Configuration
    ipsec_phase1: List[IPsecPhase1] = Field(default_factory=list, alias="ipsecPhase1")
    ipsec_phase2: List[IPsecPhase2] = Field(default_factory=list, alias="ipsecPhase2")
    ipsec_maps: List[IPsecMap] = Field(default_factory=list, alias="ipsecMaps")

    class Config:
        populate_by_name = True
        extra = "ignore"


# ============== Services Models ==============


class HsrpConfig(BaseModel):
    interface: str
    group: int
    virtual_ip: str = Field(..., alias="virtualIp")
    priority: int = 100
    preempt: bool = True

    class Config:
        populate_by_name = True
        extra = "ignore"


class DhcpExclusion(BaseModel):
    start: str
    end: str

    class Config:
        populate_by_name = True
        extra = "ignore"


class DhcpPool(BaseModel):
    name: str
    network: str
    mask: str
    default_gateway: Optional[str] = Field(None, alias="defaultGateway")
    dns_servers: List[str] = Field(default_factory=list, alias="dnsServers")
    domain_name: Optional[str] = Field(None, alias="domainName")
    lease_days: int = Field(1, alias="leaseDays")

    class Config:
        populate_by_name = True
        extra = "ignore"


class NatStatic(BaseModel):
    inside_local: str = Field(..., alias="insideLocal")
    inside_global: str = Field(..., alias="insideGlobal")

    class Config:
        populate_by_name = True
        extra = "ignore"


class NatPool(BaseModel):
    name: str
    start_ip: str = Field(..., alias="startIp")
    end_ip: str = Field(..., alias="endIp")
    netmask: str

    class Config:
        populate_by_name = True
        extra = "ignore"


class NatConfig(BaseModel):
    inside_interfaces: List[str] = Field(default_factory=list, alias="insideInterfaces")
    outside_interfaces: List[str] = Field(default_factory=list, alias="outsideInterfaces")
    static_entries: List[NatStatic] = Field(default_factory=list, alias="staticEntries")
    pools: List[NatPool] = Field(default_factory=list)
    pat_interface: Optional[str] = Field(None, alias="patInterface")
    pat_acl: Optional[str] = Field(None, alias="patAcl")

    class Config:
        populate_by_name = True
        extra = "ignore"


class ServicesConfig(BaseModel):
    hsrp: List[HsrpConfig] = Field(default_factory=list)
    dhcp_exclusions: List[DhcpExclusion] = Field(default_factory=list, alias="dhcpExclusions")
    dhcp_pools: List[DhcpPool] = Field(default_factory=list, alias="dhcpPools")
    nat: Optional[NatConfig] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


# ============== Top Level Model ==============


class IntendedConfig(BaseModel):
    hostname: Optional[str] = None

    # comes from UI (used mainly for UI gating)
    switch_type: Optional[SwitchType] = Field(None, alias="switchType")

    addressing: Optional[AddressingConfig] = None
    switching: Optional[SwitchingConfig] = None
    routing: Optional[RoutingConfig] = None
    security: Optional[SecurityConfig] = None
    services: Optional[ServicesConfig] = None

    class Config:
        populate_by_name = True
        extra = "ignore"