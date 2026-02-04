"""GNS3 REST API client"""
import httpx
from typing import Optional, Dict, List
from loguru import logger

from .models import (
    GNS3TestResponse,
    GNS3Project,
    ProjectInventory,
    DeviceInfo,
    DeviceInterface,
    LinkInfo,
)
from .interface_mapper import get_interface_name, determine_device_type


class GNS3Client:
    """Client for GNS3 REST API"""

    def __init__(self, server_url: str, auth: Optional[Dict[str, str]] = None):
        self.server_url = server_url.rstrip("/")
        self.auth = None
        if auth and auth.get("username"):
            self.auth = (auth["username"], auth["password"])

    async def test_connection(self) -> GNS3TestResponse:
        """Test connection to GNS3 server"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.server_url}/v2/version",
                    auth=self.auth,
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return GNS3TestResponse(
                        ok=True,
                        version=data.get("version"),
                        message=f"Connected to GNS3 {data.get('version')}"
                    )
                return GNS3TestResponse(ok=False, message=f"HTTP {response.status_code}")
        except Exception as e:
            logger.error(f"GNS3 connection error: {e}")
            return GNS3TestResponse(ok=False, message=str(e))

    async def list_projects(self) -> List[GNS3Project]:
        """List all projects"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.server_url}/v2/projects",
                    auth=self.auth,
                    timeout=30.0
                )
                response.raise_for_status()
                projects = []
                for p in response.json():
                    projects.append(GNS3Project(
                        projectId=p["project_id"],
                        name=p["name"],
                        status=p.get("status", "closed"),
                        path=p.get("path")
                    ))
                return projects
        except Exception as e:
            logger.error(f"Error listing projects: {e}")
            raise

    async def get_project_inventory(self, project_id: str) -> ProjectInventory:
        """Get project inventory (devices, interfaces, links)"""
        try:
            async with httpx.AsyncClient() as client:
                # Get project info
                proj_response = await client.get(
                    f"{self.server_url}/v2/projects/{project_id}",
                    auth=self.auth,
                    timeout=30.0
                )
                proj_response.raise_for_status()
                project = proj_response.json()

                # (Recommended) Ensure project is opened; some servers reject nodes/links for closed projects
                status = project.get("status")
                if status and status != "opened":
                    open_resp = await client.post(
                        f"{self.server_url}/v2/projects/{project_id}/open",
                        auth=self.auth,
                        timeout=30.0
                    )
                    open_resp.raise_for_status()

                # Get nodes
                nodes_response = await client.get(
                    f"{self.server_url}/v2/projects/{project_id}/nodes",
                    auth=self.auth,
                    timeout=30.0
                )
                nodes_response.raise_for_status()
                nodes = nodes_response.json()

                # Get links
                links_response = await client.get(
                    f"{self.server_url}/v2/projects/{project_id}/links",
                    auth=self.auth,
                    timeout=30.0
                )
                links_response.raise_for_status()
                links_data = links_response.json()

                # Map nodes for peer lookup
                node_map = {n.get("node_id"): n for n in nodes}

                # Build connected endpoints and best-effort peer mapping
                # connected_endpoints: (node_id, adapter_number, port_number)
                connected_endpoints = set()
                endpoint_to_peer: Dict[tuple, str] = {}

                for link in links_data or []:
                    ln = link.get("nodes", []) or []

                    # Mark endpoints as connected
                    for n in ln:
                        key = (
                            n.get("node_id"),
                            n.get("adapter_number", 0),
                            n.get("port_number", 0),
                        )
                        connected_endpoints.add(key)

                    # If exactly 2 endpoints, map peer text "OtherNode:IfName"
                    if len(ln) == 2:
                        a, b = ln[0], ln[1]

                        a_id = a.get("node_id")
                        b_id = b.get("node_id")

                        a_ad = a.get("adapter_number", 0)
                        a_po = a.get("port_number", 0)
                        b_ad = b.get("adapter_number", 0)
                        b_po = b.get("port_number", 0)

                        a_node = node_map.get(a_id, {}) or {}
                        b_node = node_map.get(b_id, {}) or {}

                        a_tmpl = a_node.get("node_type", "")
                        b_tmpl = b_node.get("node_type", "")

                        a_if = get_interface_name(a_tmpl, a_ad, a_po)
                        b_if = get_interface_name(b_tmpl, b_ad, b_po)

                        endpoint_to_peer[(a_id, a_ad, a_po)] = f"{b_node.get('name', '?')}:{b_if}"
                        endpoint_to_peer[(b_id, b_ad, b_po)] = f"{a_node.get('name', '?')}:{a_if}"

                # Build device list
                devices = []
                for node in nodes or []:
                    template = node.get("node_type", "")
                    device_type = determine_device_type(template, node.get("name", ""))

                    interfaces = []
                    for port in node.get("ports", []) or []:
                        adapter = port.get("adapter_number", 0)
                        pnum = port.get("port_number", 0)

                        iface_name = get_interface_name(template, adapter, pnum)

                        key = (node.get("node_id"), adapter, pnum)
                        is_connected = key in connected_endpoints

                        interfaces.append(DeviceInterface(
                            name=iface_name,
                            adapter=adapter,
                            port=pnum,
                            linkType=port.get("link_type"),
                            connected=is_connected,
                            connectedTo=endpoint_to_peer.get(key)
                        ))

                    devices.append(DeviceInfo(
                        nodeId=node.get("node_id"),
                        name=node.get("name"),
                        deviceType=device_type,
                        template=template,
                        consoleHost=node.get("console_host"),
                        consolePort=node.get("console"),
                        consoleType=node.get("console_type", "telnet"),
                        interfaces=interfaces,
                        status=node.get("status", "stopped")
                    ))

                # Build links
                links = []
                for link in links_data or []:
                    links.append(LinkInfo(
                        linkId=link.get("link_id"),
                        nodes=link.get("nodes", [])
                    ))

                return ProjectInventory(
                    projectId=project_id,
                    projectName=project.get("name", ""),
                    devices=devices,
                    links=links
                )

        except Exception as e:
            logger.error(f"Error getting inventory: {e}")
            raise
