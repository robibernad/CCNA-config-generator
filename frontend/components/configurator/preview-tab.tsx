'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api/client'

interface Props {
  device: any
  config: any
  generatedConfig: any
  isGenerating: boolean
  onGenerate: () => void
}

export function PreviewTab({ device, config, generatedConfig, isGenerating, onGenerate }: Props) {
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<any>(null)

  const handleApply = async () => {
    if (!generatedConfig?.merged) return
    
    setIsApplying(true)
    setApplyResult(null)
    
    try {
      const commands = generatedConfig.merged.split('\n').filter((line: string) => 
        line.trim() && !line.startsWith('!')
      )
      
      const result = await apiClient.applyConfig(device.nodeId, commands, true)
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

      {/* Preview */}
      {generatedConfig?.merged ? (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-slate-200 px-4 py-2 flex items-center justify-between">
            <span className="font-mono text-sm">Generated Configuration</span>
            <button
              onClick={() => navigator.clipboard.writeText(generatedConfig.merged)}
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
            >
              📋 Copy
            </button>
          </div>
          <pre className="config-preview p-4 bg-slate-900 text-green-400 overflow-auto max-h-96 text-sm">
            {generatedConfig.merged}
          </pre>
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
