'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api/client'

interface Props {
  device: any
  config: any
  generatedConfig: any
  isGenerating: boolean
  onGenerate: () => void
  deviceCredentials?: any
}

export function PreviewTab({ device, config, generatedConfig, isGenerating, onGenerate, deviceCredentials }: Props) {
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<any>(null)

  // AI Validation State
  const [labRequirements, setLabRequirements] = useState('')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [outputView, setOutputView] = useState<'raw' | 'enhanced'>('raw')
  const [fetchedRunningConfig, setFetchedRunningConfig] = useState('')
  const [isFetchingRunning, setIsFetchingRunning] = useState(false)

  const handleApply = async () => {
    if (!generatedConfig?.merged) return

    setIsApplying(true)
    setApplyResult(null)

    try {
      const commands = generatedConfig.merged.split('\n').filter((line: string) =>
        line.trim() && !line.startsWith('!')
      )

      const result = await apiClient.applyConfig(device.nodeId, commands, true, deviceCredentials)
      setApplyResult(result)
    } catch (err) {
      setApplyResult({
        ok: false,
        errors: [err instanceof Error ? err.message : 'Failed to apply config'],
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleFetchRunningConfig = async () => {
    setIsFetchingRunning(true)
    try {
      const result = await apiClient.showRunningConfig(device.nodeId, device.projectId, deviceCredentials)
      if (result.ok) {
        setFetchedRunningConfig(result.output)
      } else {
        setFetchedRunningConfig('')
        alert(`Failed to fetch running config: ${result.error || 'Unknown error'}`)
      }
    } catch (err) {
      setFetchedRunningConfig('')
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to fetch running config'}`)
    } finally {
      setIsFetchingRunning(false)
    }
  }

  const handleValidate = async () => {
    if (!generatedConfig?.merged) {
      alert('Please generate a configuration first')
      return
    }

    if (!labRequirements.trim()) {
      alert('Please enter lab requirements for validation')
      return
    }

    setIsValidating(true)
    try {
      const result = await apiClient.validateConfig(
        labRequirements,
        generatedConfig.merged,
        fetchedRunningConfig || undefined
      )
      setValidationResult(result)
      if (result.enhancedConfig) {
        setOutputView('enhanced')
      }
    } catch (err) {
      alert(`Validation error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setValidationResult(null)
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : '🔄 Generate Preview'}
        </button>

        {generatedConfig && (
          <button
            onClick={handleApply}
            disabled={isApplying || !generatedConfig.merged}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isApplying ? 'Applying...' : '🚀 Apply to Device'}
          </button>
        )}
      </div>

      {/* AI Validation Panel */}
      {generatedConfig?.merged && (
        <div className="border border-blue-200 rounded-lg bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">🤖 AI-Powered Validation</h3>

          <div className="space-y-4">
            {/* Lab Requirements */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lab Requirements
              </label>
              <textarea
                value={labRequirements}
                onChange={(e) => setLabRequirements(e.target.value)}
                placeholder="Enter your lab requirements here. E.g., 'Configure OSPF on all routers, enable SSH with strong passwords, set up inter-VLAN routing...'"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleFetchRunningConfig}
                disabled={isFetchingRunning}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50"
              >
                {isFetchingRunning ? 'Fetching...' : '📄 Fetch Running Config'}
              </button>

              <button
                onClick={handleValidate}
                disabled={isValidating || !labRequirements.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {isValidating ? 'Validating...' : '✨ Validate with AI'}
              </button>

              {fetchedRunningConfig && (
                <span className="text-sm text-green-600 flex items-center">
                  ✓ Running config fetched
                </span>
              )}
            </div>

            {/* Validation Results */}
            {validationResult && (
              <div className="mt-4 border border-slate-200 rounded-lg bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-800">Validation Results</h4>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    validationResult.isCompliant
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {validationResult.isCompliant ? '✓ Compliant' : '⚠ Issues Found'}
                  </span>
                </div>

                {validationResult.notes && (
                  <p className="text-sm text-slate-600 mb-3">{validationResult.notes}</p>
                )}

                {validationResult.issues && validationResult.issues.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-slate-700">Issues:</h5>
                    {validationResult.issues.map((issue: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded border ${
                        issue.severity === 'error' ? 'bg-red-50 border-red-200' :
                        issue.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg">
                            {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{issue.message}</p>
                            {issue.section && (
                              <p className="text-xs text-slate-500 mt-1">Section: {issue.section}</p>
                            )}
                            {issue.recommendedFix && (
                              <p className="text-xs text-slate-600 mt-2 font-mono bg-white p-2 rounded">
                                Fix: {issue.recommendedFix}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {generatedConfig?.warnings?.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Warnings</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {generatedConfig.warnings.map((w: string, i: number) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Apply Result */}
      {applyResult && (
        <div className={`p-4 rounded-lg border ${
          applyResult.ok
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            applyResult.ok ? 'text-green-800' : 'text-red-800'
          }`}>
            {applyResult.ok ? '✅ Configuration Applied Successfully' : '❌ Application Failed'}
          </h4>

          {applyResult.log && (
            <pre className="text-xs bg-white p-3 rounded mt-2 overflow-auto max-h-40">
              {applyResult.log.join('\n')}
            </pre>
          )}

          {applyResult.errors?.length > 0 && (
            <ul className="text-sm text-red-700 mt-2">
              {applyResult.errors.map((e: string, i: number) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Preview with Raw/Enhanced Tabs */}
      {generatedConfig?.merged ? (
        <div>
          {/* Output View Tabs */}
          {validationResult?.enhancedConfig && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setOutputView('raw')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                  outputView === 'raw'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Raw Output
              </button>
              <button
                onClick={() => setOutputView('enhanced')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                  outputView === 'enhanced'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                ✨ Enhanced Output (AI Suggested)
              </button>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className={`px-4 py-2 flex items-center justify-between ${
              outputView === 'enhanced' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-200'
            }`}>
              <span className="font-mono text-sm">
                {outputView === 'enhanced' ? '✨ AI-Enhanced Configuration' : 'Generated Configuration'}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(
                  outputView === 'enhanced' && validationResult?.enhancedConfig
                    ? validationResult.enhancedConfig
                    : generatedConfig.merged
                )}
                className={`text-xs px-3 py-1 rounded ${
                  outputView === 'enhanced' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                📋 Copy
              </button>
            </div>
            <pre className={`config-preview p-4 overflow-auto max-h-96 text-sm ${
              outputView === 'enhanced' ? 'bg-purple-50 text-purple-900' : 'bg-slate-900 text-green-400'
            }`}>
              {outputView === 'enhanced' && validationResult?.enhancedConfig
                ? validationResult.enhancedConfig
                : generatedConfig.merged}
            </pre>
          </div>

          {outputView === 'enhanced' && (
            <p className="text-xs text-slate-500 mt-2">
              ⚠️ This is an AI-suggested configuration. Please review carefully before applying.
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
          <p className="text-lg mb-2">No configuration generated yet</p>
          <p className="text-sm">Configure the device using the tabs above, then click "Generate Preview"</p>
        </div>
      )}

      {/* Per-Module View */}
      {generatedConfig?.perModule && Object.keys(generatedConfig.perModule).length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 mb-3">Configuration by Module</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(generatedConfig.perModule).map(([module, code]) => (
              <div key={module} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-medium text-sm capitalize">
                  {module}
                </div>
                <pre className="p-3 text-xs bg-slate-50 overflow-auto max-h-40">
                  {code as string}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
