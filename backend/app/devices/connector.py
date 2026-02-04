"""Device connector using Netmiko"""
from typing import Optional, List
from loguru import logger

from app.sessions.models import DeviceCredentials
from .models import ExecuteCommandResponse, ApplyConfigResponse


class DeviceConnector:
    """Connect to network devices using Netmiko"""
    
    def __init__(
        self,
        host: str,
        port: int,
        credentials: DeviceCredentials,
        device_type: str = "cisco_ios"
    ):
        self.host = host
        self.port = port
        self.credentials = credentials
        self.device_type = device_type
        self._connection = None
    
    def _get_connection_params(self) -> dict:
        """Get Netmiko connection parameters"""
        params = {
            "device_type": self.device_type,
            "host": self.host,
            "port": self.port,
            "username": self.credentials.username,
            "password": self.credentials.password,
        }
        
        if self.credentials.enable_secret:
            params["secret"] = self.credentials.enable_secret
        
        # Use telnet or SSH based on transport
        if self.credentials.transport == "telnet":
            params["device_type"] = "cisco_ios_telnet"
        
        return params
    
    async def execute_command(self, command: str) -> ExecuteCommandResponse:
        """Execute a show command"""
        try:
            from netmiko import ConnectHandler
            
            params = self._get_connection_params()
            
            with ConnectHandler(**params) as conn:
                if self.credentials.enable_secret:
                    conn.enable()
                
                output = conn.send_command(command)
                
                return ExecuteCommandResponse(
                    ok=True,
                    output=output
                )
        except Exception as e:
            logger.error(f"Command execution error: {e}")
            return ExecuteCommandResponse(
                ok=False,
                output="",
                error=str(e)
            )
    
    async def apply_config(self, commands: List[str], save: bool = True) -> ApplyConfigResponse:
        """Apply configuration commands"""
        log = []
        warnings = []
        errors = []
        
        try:
            from netmiko import ConnectHandler
            
            params = self._get_connection_params()
            
            with ConnectHandler(**params) as conn:
                if self.credentials.enable_secret:
                    conn.enable()
                
                log.append("Connected to device")
                log.append("Entering configuration mode")
                
                # Send config commands
                output = conn.send_config_set(commands)
                log.append(output)
                
                # Check for errors in output
                if "% Invalid" in output or "% Incomplete" in output:
                    errors.append("Some commands may have failed")
                
                # Save configuration
                if save:
                    log.append("Saving configuration")
                    save_output = conn.save_config()
                    log.append(save_output)
                
                log.append("Configuration applied successfully")
                
                return ApplyConfigResponse(
                    ok=len(errors) == 0,
                    log=log,
                    warnings=warnings,
                    errors=errors
                )
        except Exception as e:
            logger.error(f"Config apply error: {e}")
            errors.append(str(e))
            return ApplyConfigResponse(
                ok=False,
                log=log,
                warnings=warnings,
                errors=errors
            )
