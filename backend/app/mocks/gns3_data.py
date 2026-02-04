"""Mock GNS3 data for testing"""
from app.gns3.models import GNS3Project, ProjectInventory, DeviceInfo, DeviceInterface, LinkInfo


def get_mock_projects():
    """Return mock GNS3 projects - all opened for testing"""
    return [
        GNS3Project(
            projectId="proj-001",
            name="CCNA Lab - Basic Routing",
            status="opened",
            path="/projects/ccna-basic"
        ),
        GNS3Project(
            projectId="proj-002",
            name="CCNA Lab - Switching",
            status="opened",
            path="/projects/ccna-switching"
        ),
        GNS3Project(
            projectId="proj-003",
            name="Enterprise Network",
            status="opened",
            path="/projects/enterprise"
        ),
    ]


def get_mock_inventory(project_id: str):
    """Return mock project inventory"""
    if project_id == "proj-001":
        return ProjectInventory(
            projectId="proj-001",
            projectName="CCNA Lab - Basic Routing",
            devices=[
                DeviceInfo(
                    nodeId="node-r1",
                    name="R1",
                    deviceType="router",
                    template="IOSv",
                    consoleHost="127.0.0.1",
                    consolePort=5001,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="SW1"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=1, port=0, connected=True, connectedTo="R2"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=2, port=0, connected=False),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=3, port=0, connected=False),
                    ]
                ),
                DeviceInfo(
                    nodeId="node-r2",
                    name="R2",
                    deviceType="router",
                    template="IOSv",
                    consoleHost="127.0.0.1",
                    consolePort=5002,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="SW2"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=1, port=0, connected=True, connectedTo="R1"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=2, port=0, connected=False),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=3, port=0, connected=False),
                    ]
                ),
                DeviceInfo(
                    nodeId="node-sw1",
                    name="SW1",
                    deviceType="switch",
                    template="IOSvL2",
                    consoleHost="127.0.0.1",
                    consolePort=5003,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="R1"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=0, port=1, connected=True, connectedTo="PC1"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=0, port=2, connected=False),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=0, port=3, connected=False),
                        DeviceInterface(name="GigabitEthernet1/0", adapter=1, port=0, connected=False),
                        DeviceInterface(name="GigabitEthernet1/1", adapter=1, port=1, connected=False),
                        DeviceInterface(name="GigabitEthernet1/2", adapter=1, port=2, connected=False),
                        DeviceInterface(name="GigabitEthernet1/3", adapter=1, port=3, connected=False),
                    ]
                ),
            ],
            links=[
                LinkInfo(linkId="link-1", nodes=[{"node_id": "node-r1", "port": 0}, {"node_id": "node-sw1", "port": 0}]),
                LinkInfo(linkId="link-2", nodes=[{"node_id": "node-r1", "port": 1}, {"node_id": "node-r2", "port": 1}]),
            ]
        )
    elif project_id == "proj-002":
        return ProjectInventory(
            projectId="proj-002",
            projectName="CCNA Lab - Switching",
            devices=[
                DeviceInfo(
                    nodeId="node-core-sw",
                    name="Core-SW",
                    deviceType="switch",
                    template="IOSvL2",
                    consoleHost="127.0.0.1",
                    consolePort=5010,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="Access-SW1"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=0, port=1, connected=True, connectedTo="Access-SW2"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=0, port=2, connected=True, connectedTo="Router1"),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=0, port=3, connected=False),
                        DeviceInterface(name="GigabitEthernet1/0", adapter=1, port=0, connected=False),
                        DeviceInterface(name="GigabitEthernet1/1", adapter=1, port=1, connected=False),
                    ]
                ),
                DeviceInfo(
                    nodeId="node-access-sw1",
                    name="Access-SW1",
                    deviceType="switch",
                    template="IOSvL2",
                    consoleHost="127.0.0.1",
                    consolePort=5011,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="Core-SW"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=0, port=1, connected=True, connectedTo="PC1"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=0, port=2, connected=True, connectedTo="PC2"),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=0, port=3, connected=False),
                    ]
                ),
                DeviceInfo(
                    nodeId="node-access-sw2",
                    name="Access-SW2",
                    deviceType="switch",
                    template="IOSvL2",
                    consoleHost="127.0.0.1",
                    consolePort=5012,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="Core-SW"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=0, port=1, connected=True, connectedTo="PC3"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=0, port=2, connected=False),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=0, port=3, connected=False),
                    ]
                ),
            ],
            links=[
                LinkInfo(linkId="link-1", nodes=[{"node_id": "node-core-sw", "port": 0}, {"node_id": "node-access-sw1", "port": 0}]),
                LinkInfo(linkId="link-2", nodes=[{"node_id": "node-core-sw", "port": 1}, {"node_id": "node-access-sw2", "port": 0}]),
            ]
        )
    elif project_id == "proj-003":
        return ProjectInventory(
            projectId="proj-003",
            projectName="Enterprise Network",
            devices=[
                DeviceInfo(
                    nodeId="node-edge-r1",
                    name="Edge-Router",
                    deviceType="router",
                    template="IOSv",
                    consoleHost="127.0.0.1",
                    consolePort=5020,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="ISP"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=1, port=0, connected=True, connectedTo="Core-SW"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=2, port=0, connected=False),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=3, port=0, connected=False),
                    ]
                ),
                DeviceInfo(
                    nodeId="node-core-r1",
                    name="Core-Router",
                    deviceType="router",
                    template="IOSv",
                    consoleHost="127.0.0.1",
                    consolePort=5021,
                    consoleType="telnet",
                    status="started",
                    interfaces=[
                        DeviceInterface(name="GigabitEthernet0/0", adapter=0, port=0, connected=True, connectedTo="Edge-Router"),
                        DeviceInterface(name="GigabitEthernet0/1", adapter=1, port=0, connected=True, connectedTo="Dist-SW1"),
                        DeviceInterface(name="GigabitEthernet0/2", adapter=2, port=0, connected=True, connectedTo="Dist-SW2"),
                        DeviceInterface(name="GigabitEthernet0/3", adapter=3, port=0, connected=False),
                    ]
                ),
            ],
            links=[
                LinkInfo(linkId="link-1", nodes=[{"node_id": "node-edge-r1", "port": 1}, {"node_id": "node-core-r1", "port": 0}]),
            ]
        )
    else:
        return ProjectInventory(
            projectId=project_id,
            projectName="Unknown Project",
            devices=[],
            links=[]
        )


def get_mock_show_output(command: str) -> str:
    """Return mock show command output"""
    command_lower = command.lower()
    
    if "running-config" in command_lower or "run" in command_lower:
        return """Building configuration...

Current configuration : 1234 bytes
!
version 15.9
hostname R1
!
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet0/1
 ip address 10.0.0.1 255.255.255.252
 no shutdown
!
router ospf 1
 router-id 1.1.1.1
 network 192.168.1.0 0.0.0.255 area 0
 network 10.0.0.0 0.0.0.3 area 0
!
end
"""
    elif "ip interface brief" in command_lower:
        return """Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.1.1     YES NVRAM  up                    up
GigabitEthernet0/1     10.0.0.1        YES NVRAM  up                    up
GigabitEthernet0/2     unassigned      YES NVRAM  administratively down down
GigabitEthernet0/3     unassigned      YES NVRAM  administratively down down
"""
    elif "ospf neighbor" in command_lower:
        return """Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   FULL/DR         00:00:38    10.0.0.2        GigabitEthernet0/1
"""
    elif "vlan brief" in command_lower:
        return """VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Gi0/0, Gi0/1, Gi0/2, Gi0/3
10   Management                       active    
20   Users                            active    
30   Servers                          active    
1002 fddi-default                     act/unsup 
1003 token-ring-default               act/unsup 
1004 fddinet-default                  act/unsup 
1005 trnet-default                    act/unsup 
"""
    elif "ip route" in command_lower:
        return """Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP
       O - OSPF, IA - OSPF inter area

Gateway of last resort is not set

C    192.168.1.0/24 is directly connected, GigabitEthernet0/0
C    10.0.0.0/30 is directly connected, GigabitEthernet0/1
O    192.168.2.0/24 [110/2] via 10.0.0.2, 00:05:23, GigabitEthernet0/1
"""
    elif "spanning-tree" in command_lower:
        return """VLAN0001
  Spanning tree enabled protocol rstp
  Root ID    Priority    32769
             Address     aabb.cc00.0100
             This bridge is the root
             
  Bridge ID  Priority    32769
             Address     aabb.cc00.0100
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
"""
    else:
        return f"% Output for: {command}\n(Mock mode - simulated output)"
