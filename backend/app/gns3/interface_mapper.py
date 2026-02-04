"""Interface name mapping for different device types"""
from typing import Dict, Tuple


# Interface naming patterns for different device templates
INTERFACE_MAPS: Dict[str, Dict[Tuple[int, int], str]] = {
    # Cisco IOSv Router
    "iosv": {
        (0, 0): "GigabitEthernet0/0",
        (1, 0): "GigabitEthernet0/1",
        (2, 0): "GigabitEthernet0/2",
        (3, 0): "GigabitEthernet0/3",
    },
    # Cisco IOSvL2 Switch
    "iosvl2": {
        (0, 0): "GigabitEthernet0/0",
        (0, 1): "GigabitEthernet0/1",
        (0, 2): "GigabitEthernet0/2",
        (0, 3): "GigabitEthernet0/3",
        (1, 0): "GigabitEthernet1/0",
        (1, 1): "GigabitEthernet1/1",
        (1, 2): "GigabitEthernet1/2",
        (1, 3): "GigabitEthernet1/3",
        (2, 0): "GigabitEthernet2/0",
        (2, 1): "GigabitEthernet2/1",
        (2, 2): "GigabitEthernet2/2",
        (2, 3): "GigabitEthernet2/3",
        (3, 0): "GigabitEthernet3/0",
        (3, 1): "GigabitEthernet3/1",
        (3, 2): "GigabitEthernet3/2",
        (3, 3): "GigabitEthernet3/3",
    },
    # Cisco IOU
    "iou": {
        (0, 0): "Ethernet0/0",
        (0, 1): "Ethernet0/1",
        (0, 2): "Ethernet0/2",
        (0, 3): "Ethernet0/3",
        (1, 0): "Ethernet1/0",
        (1, 1): "Ethernet1/1",
        (1, 2): "Ethernet1/2",
        (1, 3): "Ethernet1/3",
        (2, 0): "Serial2/0",
        (2, 1): "Serial2/1",
        (2, 2): "Serial2/2",
        (2, 3): "Serial2/3",
        (3, 0): "Serial3/0",
        (3, 1): "Serial3/1",
        (3, 2): "Serial3/2",
        (3, 3): "Serial3/3",
    },
    # Cisco IOU L2 Switch
    "ioul2": {
        (0, 0): "Ethernet0/0",
        (0, 1): "Ethernet0/1",
        (0, 2): "Ethernet0/2",
        (0, 3): "Ethernet0/3",
        (1, 0): "Ethernet1/0",
        (1, 1): "Ethernet1/1",
        (1, 2): "Ethernet1/2",
        (1, 3): "Ethernet1/3",
        (2, 0): "Ethernet2/0",
        (2, 1): "Ethernet2/1",
        (2, 2): "Ethernet2/2",
        (2, 3): "Ethernet2/3",
        (3, 0): "Ethernet3/0",
        (3, 1): "Ethernet3/1",
        (3, 2): "Ethernet3/2",
        (3, 3): "Ethernet3/3",
    },
}


def get_interface_name(template: str, adapter: int, port: int) -> str:
    """Get interface name from template and adapter/port"""
    template_lower = template.lower() if template else ""
    
    # Determine which map to use
    if "iosvl2" in template_lower or "l2" in template_lower:
        interface_map = INTERFACE_MAPS.get("iosvl2", {})
    elif "iosv" in template_lower:
        interface_map = INTERFACE_MAPS.get("iosv", {})
    elif "ioul2" in template_lower:
        interface_map = INTERFACE_MAPS.get("ioul2", {})
    elif "iou" in template_lower:
        interface_map = INTERFACE_MAPS.get("iou", {})
    else:
        # Default to GigabitEthernet naming
        return f"GigabitEthernet{adapter}/{port}"
    
    return interface_map.get((adapter, port), f"Interface{adapter}/{port}")


def determine_device_type(template: str, name: str) -> str:
    """Determine device type from template or name"""
    combined = f"{template} {name}".lower()
    
    if any(x in combined for x in ["switch", "l2", "sw"]):
        return "switch"
    elif any(x in combined for x in ["router", "r", "iosv"]):
        return "router"
    elif any(x in combined for x in ["cloud", "nat"]):
        return "cloud"
    elif any(x in combined for x in ["pc", "host", "vpcs"]):
        return "host"
    else:
        return "router"  # Default to router
