'use client'

import { useEffect, useMemo, useState } from 'react'
import { AddressingTab } from './addressing-tab'
import { SwitchingTab } from './switching-tab'
import { RoutingTab } from './routing-tab'
import { SecurityTab } from './security-tab'
import { ServicesTab } from './services-tab'
import { PreviewTab } from './preview-tab'
import { apiClient } from '@/lib/api/client'
import { getUsedSwitchPorts } from '@/lib/utils/interfaces'

interface Device {
  nodeId: string
  name: string
  deviceType: string
  interfaces: Array<{
    name: string
    connected: boolean
  }>
}

interface IntendedConfig {
  hostname?: string
  // Switch-specific
  switchType?: 'l2' | 'msw'
  addressing?: any
  switching?: any
  routing?: any
  security?: any
  services?: any
}

const TABS = [
  { id: 'addressing', label: 'Addressing', icon: '🔢' },
  { id: 'switching', label: 'Switching', icon: '🔲' },
  { id: 'routing', label: 'Routing', icon: '🔀' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'services', label: 'Services', icon: '⚙️' },
  { id: 'preview', label: 'Preview & Apply', icon: '📋' },
]

// ---------- Defaults (so options appear even if user doesn't open a tab) ----------
function defaultSecurity() {
  return {
    deviceAccess: {
      enableSecret: "",
      servicePasswordEncryption: false,
      bannerMotd: "",
      users: [],
      ssh: {
        enabled: false,
        domainName: "",
        rsaModulus: 2048,
        version: 2,
        vtyStart: 0,
        vtyEnd: 4,
        allowTelnet: false,
        execTimeoutMin: 10,
        execTimeoutSec: 0,
      },
    },
    standardAcls: [],
    extendedAcls: [],
    aclApplications: [],
    // Initialize empty IPsec lists
    ipsecPhase1: [],
    ipsecPhase2: [],
    ipsecMaps: [],
  };
}

function defaultServices() {
  return {
    dhcpExclusions: [],
    dhcpPools: [],
    hsrp: [],
    nat: null,
  };
}

function defaultRouting() {
  return {
    defaultRoute: null,
    staticRoutes: [],
    ospf: null,
    eigrp: null,
    greTunnels: [],
    vrfs: [], // Initialize empty VRF list
    bgp: null,
  };
}

export function DeviceConfigurator({ device }: { device: Device }) {
  const [activeTab, setActiveTab] = useState('addressing')

  // Identify device capabilities
  const isSwitch = device.deviceType === 'switch'
  const isRouter = device.deviceType === 'router'
  // Treat 'nat' or 'cloud' as a dedicated NAT device
  const isNatDevice = device.deviceType === 'nat' || device.deviceType === 'cloud'

  const makeInitialConfig = (): IntendedConfig => {
    // Initialize with sane defaults so "SSH / NAT / VPN" options are always available in the UI.
    const base: IntendedConfig = {
      hostname: device.name,
      security: defaultSecurity(),
    }

    if (isSwitch) {
      return {
        ...base,
        // Default: switches are L2 unless user toggles MSW
        switchType: 'l2',
      }
    }

    // Routers and NAT devices: include routing/services defaults
    return {
      ...base,
      routing: defaultRouting(),
      services: defaultServices(),
    }
  }

  const [config, setConfig] = useState<IntendedConfig>(() => makeInitialConfig())
  const [generatedConfig, setGeneratedConfig] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When switching between devices, reset the configurator state.
  useEffect(() => {
    setActiveTab('addressing')
    setGeneratedConfig(null)
    setError(null)
    setConfig(makeInitialConfig())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.nodeId])

  const isMsw = isSwitch && config.switchType === 'msw'

  // Ensure optional sections exist when the user switches device capabilities.
  useEffect(() => {
    setConfig((prev) => {
      let changed = false
      const next: IntendedConfig = { ...prev }

      if (!next.security) {
        // @ts-expect-error - lightweight typing
        next.security = defaultSecurity()
        changed = true
      }

      // If it's a Router, MSW, or NAT device, ensure L3 sections exist
      const needsL3 = !isSwitch || (isSwitch && prev.switchType === 'msw')
      
      if (needsL3) {
        if (!next.routing) {
          // @ts-expect-error - lightweight typing
          next.routing = defaultRouting()
          changed = true
        }
        if (!next.services) {
          // @ts-expect-error - lightweight typing
          next.services = defaultServices()
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [isSwitch, config.switchType])

  // Ports consumed by L2 switching config (access/trunk/EtherChannel members).
  const usedSwitchPorts = useMemo(() => {
    const s = (config as any).switching
    return Array.from(getUsedSwitchPorts(s))
  }, [(config as any).switching])

  const updateConfig = (section: string, data: any) => {
    setConfig((prev) => ({
      ...prev,
      [section]: data,
    }))
    setGeneratedConfig(null) // Clear preview when config changes
  }

  const updateTopLevel = (data: Partial<IntendedConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...data,
    }))
    setGeneratedConfig(null)
  }

  const generatePreview = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const result = await apiClient.generateConfig(config)
      setGeneratedConfig(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate config')
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredTabs = TABS.filter((tab) => {
    // --- 1. NAT Device Logic ---
    if (isNatDevice) {
        // NAT devices only see Addressing, Services (renamed to NAT Config), and Preview
        return ['addressing', 'services', 'preview'].includes(tab.id)
    }

    // --- 2. Router Logic ---
    // Hide switching tab for routers
    if (tab.id === 'switching' && isRouter) return false

    // --- 3. Switch Logic ---
    // Routing & Services are not applicable on L2 switches (only MSW)
    if (isSwitch && !isMsw && (tab.id === 'routing' || tab.id === 'services')) return false

    return true
  })

  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 flex-none">
        <div className="flex items-center gap-3">
          <span className="text-3xl">
             {isNatDevice ? '☁️' : isRouter ? '🔀' : '🔲'}
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{device.name}</h2>
            <p className="text-sm text-slate-500 capitalize">
              {isNatDevice ? 'NAT Gateway / Cloud' : isRouter ? 'Router' : isMsw ? 'Multilayer Switch (MSW)' : 'Switch (L2)'}
            </p>
          </div>

          {/* Switch type toggle */}
          {isSwitch && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-slate-600">Switch type</span>
              <select
                value={config.switchType || 'l2'}
                onChange={(e) => updateTopLevel({ switchType: e.target.value as 'l2' | 'msw' })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                title="L2 switches don’t run routing protocols. MSW enables inter-VLAN routing and L3 services."
              >
                <option value="l2">L2 (default)</option>
                <option value="msw">MSW (multilayer)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex-none">
        <div className="flex overflow-x-auto">
          {filteredTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {/* Dynamic Label for NAT devices */}
              {tab.id === 'services' && isNatDevice ? 'NAT Configuration' : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 overflow-y-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {activeTab === 'addressing' && (
          <AddressingTab
            interfaces={device.interfaces}
            usedSwitchPorts={usedSwitchPorts}
            deviceType={device.deviceType}
            switchType={config.switchType}
            config={config.addressing}
            onUpdate={(data) => updateConfig('addressing', data)}
          />
        )}

        {activeTab === 'switching' && (
          <SwitchingTab
            interfaces={device.interfaces}
            deviceType={device.deviceType}
            switchType={config.switchType}
            config={config.switching}
            onUpdate={(data) => updateConfig('switching', data)}
          />
        )}

        {activeTab === 'routing' && (
          <RoutingTab
            interfaces={device.interfaces}
            usedSwitchPorts={usedSwitchPorts}
            config={config.routing}
            onUpdate={(data) => updateConfig('routing', data)}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            config={config.security}
            onUpdate={(data) => updateConfig('security', data)}
            deviceType={device.deviceType} // <--- Added this to control IPsec visibility
          />
        )}

        {activeTab === 'services' && (
          <ServicesTab
            interfaces={device.interfaces}
            usedSwitchPorts={usedSwitchPorts}
            deviceType={device.deviceType}
            switchType={config.switchType}
            config={config.services}
            onUpdate={(data) => updateConfig('services', data)}
            // Pass context to control visibility of NAT vs General services
            // @ts-expect-error - Adding prop dynamically before file is updated
            context={isNatDevice ? 'nat' : 'router'}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewTab
            device={device}
            config={config}
            generatedConfig={generatedConfig}
            isGenerating={isGenerating}
            onGenerate={generatePreview}
          />
        )}
      </div>
    </div>
  )
}