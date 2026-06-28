import React, { useEffect, useMemo, useState, useRef } from 'react'
// import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { getAdminSettings, updateAdminSettings, AdminSettings, getVectorStoreFiles, addVectorStoreFile, deleteVectorStoreFile, VectorStoreFile, getVectorStoreInfo, VectorStoreInfo } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type ChatbotType = 'control_chart' | 'planned_experiment'

interface SettingsTabContentProps {
  id: number
}

const SettingsTabContent: React.FC<SettingsTabContentProps> = ({ id }) => {
  const { isDarkMode } = useTheme()

  const [initial, setInitial] = useState<AdminSettings | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [helpText, setHelpText] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [savingHelp, setSavingHelp] = useState(false)
  const [savingAbout, setSavingAbout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Vector store files state
  const [vectorStoreFiles, setVectorStoreFiles] = useState<VectorStoreFile[]>([])
  const [vectorStoreLoading, setVectorStoreLoading] = useState(false)
  const [vectorStoreError, setVectorStoreError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<{
    hasMore: boolean
    lastId: string | null
    firstId: string | null
  }>({ hasMore: false, lastId: null, firstId: null })
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Vector store metadata state
  const [vectorStoreInfo, setVectorStoreInfo] = useState<VectorStoreInfo | null>(null)
  const [vectorStoreInfoError, setVectorStoreInfoError] = useState<string | null>(null)
  const [vectorStoreInfoLoading, setVectorStoreInfoLoading] = useState(false)

  const loadVectorStoreFiles = async (after?: string) => {
    setVectorStoreLoading(true)
    setVectorStoreError(null)
    try {
      const response = await getVectorStoreFiles({
        settings_id: id,
        limit: 20,
        order: 'desc',
        ...(after && { after })
      })
      if (after) {
        // Append to existing files for pagination
        setVectorStoreFiles(prev => [...prev, ...response.data])
      } else {
        // Replace files for initial load
        setVectorStoreFiles(response.data)
      }
      setPagination({
        hasMore: response.has_more,
        lastId: response.last_id,
        firstId: response.first_id
      })
    } catch (e: any) {
      setVectorStoreError(e?.message || 'Failed to load vector store files')
    } finally {
      setVectorStoreLoading(false)
    }
  }

  const loadVectorStoreInfo = async () => {
    setVectorStoreInfoLoading(true)
    setVectorStoreInfoError(null)
    try {
      const info = await getVectorStoreInfo(id)
      setVectorStoreInfo(info)
    } catch (e: any) {
      setVectorStoreInfoError(e?.message || 'Failed to load vector store info')
    } finally {
      setVectorStoreInfoLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const s = await getAdminSettings(id)
        if (!mounted) return
        setInitial({ ...s, id: id })
        setSystemPrompt(s.system_prompt || '')
        setHelpText(s.help_text || '')
        setAboutText(s.about_text || '')

        // Load vector store files and info
        await Promise.all([loadVectorStoreFiles(), loadVectorStoreInfo()])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load settings')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  const hasSystemPromptChange = useMemo(() => {
    if (!initial) return false
    return systemPrompt !== (initial.system_prompt || '')
  }, [initial, systemPrompt])

  const hasHelpTextChange = useMemo(() => {
    if (!initial) return false
    return helpText !== (initial.help_text || '')
  }, [initial, helpText])

  const hasAboutTextChange = useMemo(() => {
    if (!initial) return false
    return aboutText !== (initial.about_text || '')
  }, [initial, aboutText])


  const handleSaveSystemPrompt = async () => {
    if (!initial) return
    setSavingPrompt(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminSettings({ 
        system_prompt: systemPrompt, 
        help_text: initial.help_text || '',
        about_text: initial.about_text || '',
        id: id
      })
      setInitial({ ...updated, id: id })
      setSuccess('System prompt saved')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e: any) {
      setError(e?.message || 'Failed to save system prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleSaveHelpText = async () => {
    if (!initial) return
    setSavingHelp(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminSettings({ 
        system_prompt: initial.system_prompt || '', 
        help_text: helpText,
        about_text: initial.about_text || '',
        id: id
      })
      setInitial({ ...updated, id: id })
      setSuccess('Help text saved')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e: any) {
      setError(e?.message || 'Failed to save help text')
    } finally {
      setSavingHelp(false)
    }
  }

  const handleSaveAboutText = async () => {
    if (!initial) return
    setSavingAbout(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminSettings({ 
        system_prompt: initial.system_prompt || '', 
        help_text: initial.help_text || '',
        about_text: aboutText,
        id: id
      })
      setInitial({ ...updated, id: id })
      setSuccess('About text saved')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e: any) {
      setError(e?.message || 'Failed to save about text')
    } finally {
      setSavingAbout(false)
    }
  }

 

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, i)
    return `${value.toFixed(2)} ${units[i]}`
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      completed: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
      failed: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100'
    }
    const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100'
    return <Badge className={colorClass}>{status}</Badge>
  }

  const handleLoadMore = () => {
    if (pagination.hasMore && pagination.lastId) {
      loadVectorStoreFiles(pagination.lastId)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    setUploadError(null)
    try {
      await addVectorStoreFile(file, id)
      // Wait a bit longer for OpenAI to index the file before reloading
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Reload the vector store files list and info
      await Promise.all([loadVectorStoreFiles(), loadVectorStoreInfo()])
      setSuccess(`File "${file.name}" uploaded successfully`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setUploadError(e?.message || 'Failed to upload file')
    } finally {
      setUploadingFile(false)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file from the vector store?')) {
      return
    }

    // Add file to deleting set
    setDeletingFiles(prev => new Set(prev).add(fileId))
    setError(null)
    setSuccess(null)

    try {
      await deleteVectorStoreFile(fileId, id)
      // Wait a bit longer for OpenAI to update the vector store before reloading
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Reload the vector store files list and info
      await Promise.all([loadVectorStoreFiles(), loadVectorStoreInfo()])
      setSuccess('File deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setError(e?.message || 'Failed to delete file')
    } finally {
      // Remove file from deleting set
      setDeletingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })
    }
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-dark-background' : 'bg-light-background'}`}>
        <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        {/* Global notifications */}
        {error && (
          <div className="mb-6 rounded border border-red-400 bg-red-50 text-red-700 p-3 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-6 rounded border border-green-500 bg-green-50 text-green-700 p-3 text-sm">{success}</div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column - System Prompt and Help Text */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={15}
                  className={`w-full rounded border p-3 text-sm ${isDarkMode ? 'bg-dark-surface border-dark-border text-dark-text' : 'bg-light-surface border-light-border text-light-text'}`}
                  placeholder="Enter the system prompt used by the assistant"
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleSaveSystemPrompt} disabled={!hasSystemPromptChange || savingPrompt}>
                    {savingPrompt ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Help Text</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  rows={10}
                  className={`w-full rounded border p-3 text-sm ${isDarkMode ? 'bg-dark-surface border-dark-border text-dark-text' : 'bg-light-surface border-light-border text-light-text'}`}
                  placeholder="Enter the help text shown to users"
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleSaveHelpText} disabled={!hasHelpTextChange || savingHelp}>
                    {savingHelp ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">About Text</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  rows={10}
                  className={`w-full rounded border p-3 text-sm ${isDarkMode ? 'bg-dark-surface border-dark-border text-dark-text' : 'bg-light-surface border-light-border text-light-text'}`}
                  placeholder="Enter the about text shown on the About page"
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleSaveAboutText} disabled={!hasAboutTextChange || savingAbout}>
                    {savingAbout ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>


          </div>

          {/* Right column - Vector Store Management */}
          <div className="space-y-6">
            {/* Vector Store Info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Vector Store</CardTitle>
              </CardHeader>
              <CardContent>
                {vectorStoreInfoError && (
                  <div className="mb-4 rounded border border-red-400 bg-red-50 text-red-700 p-3 text-sm">
                    {vectorStoreInfoError}
                  </div>
                )}
                {vectorStoreInfoLoading ? (
                  <div className="text-sm">
                    <span className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Loading vector store info...</span>
                  </div>
                ) : vectorStoreInfo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Name</div>
                      <div className={isDarkMode ? 'text-dark-text' : 'text-light-text'}>{vectorStoreInfo.name || '—'}</div>
                    </div>
                    {vectorStoreInfo.total_bytes > 0 && (
                      <div>
                        <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Used Space</div>
                        <div className={isDarkMode ? 'text-dark-text' : 'text-light-text'}>{formatBytes(vectorStoreInfo.total_bytes)}</div>
                      </div>
                    )}
                    <div>
                      <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Created</div>
                      <div className={isDarkMode ? 'text-dark-text' : 'text-light-text'}>{vectorStoreInfo.created_at ? formatDate(vectorStoreInfo.created_at) : '—'}</div>
                    </div>
                    {vectorStoreInfo.updated_at && (
                      <div>
                        <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Last Modified</div>
                        <div className={isDarkMode ? 'text-dark-text' : 'text-light-text'}>{formatDate(vectorStoreInfo.updated_at)}</div>
                      </div>
                    )}
                    <div>
                      <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Files</div>
                      <div className={isDarkMode ? 'text-dark-text' : 'text-light-text'}>{vectorStoreInfo.file_count}</div>
                    </div>
                    <div>
                      <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>Vector Store ID</div>
                      <div className={`font-mono ${isDarkMode ? 'text-dark-text' : 'text-light-text'}`}>{vectorStoreInfo.id}</div>
                    </div>
                  </div>
                ) : (
                  <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>No vector store info available</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-card-foreground">Vector Store Files</CardTitle>
                  <Button onClick={triggerFileUpload} disabled={uploadingFile} size="sm">
                    {uploadingFile ? 'Uploading...' : 'Add File'}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".txt,.pdf,.doc,.docx,.md"
                />
              </CardHeader>
              <CardContent>
                {uploadError && (
                  <div className="mb-4 rounded border border-red-400 bg-red-50 text-red-700 p-3 text-sm">
                    {uploadError}
                  </div>
                )}

                {vectorStoreError && (
                  <div className="mb-4 rounded border border-red-400 bg-red-50 text-red-700 p-3 text-sm">
                    {vectorStoreError}
                  </div>
                )}

                {vectorStoreLoading && vectorStoreFiles.length === 0 ? (
                  <div className="text-center py-4">
                    <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>
                      Loading vector store files...
                    </div>
                  </div>
                ) : vectorStoreFiles.length === 0 ? (
                  <div className="text-center py-4">
                    <div className={isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}>
                      No files found in vector store
                    </div>
                    <div className={`text-xs mt-2 ${isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`}>
                      Upload files to add them to the vector store
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Scrollable list to avoid elongating the right column */}
                     <div className="space-y-2 max-h-[32.84rem] overflow-y-auto pr-2">
                      {vectorStoreFiles.map((file) => (
                        <div
                          key={file.id}
                          className={`p-4 rounded border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-light-surface border-light-border'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className={`${isDarkMode ? 'text-dark-text' : 'text-light-text'} font-medium truncate max-w-[16rem] sm:max-w-[20rem]`}>
                                {file.filename || `File ${file.id?.slice(0, 8) || 'Unknown'}`}
                              </span>
                              {getStatusBadge(file.status)}
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <span className={`text-xs ${isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`}>
                                {formatDate(file.created_at)}
                              </span>
                              <Button
                                onClick={() => handleDeleteFile(file.id)}
                                variant="outline"
                                size="sm"
                                disabled={deletingFiles.has(file.id)}
                                className={isDarkMode
                                  ? "text-red-500 bg-white border-gray-600 hover:text-red-500 hover:bg-white"
                                  : "text-red-600 bg-white border-gray-300 hover:text-red-600 hover:bg-white"
                                }
                              >
                                {deletingFiles.has(file.id) ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                          {file.chunking_strategy && (
                            <div className={`text-xs ${isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`}>
                              Chunking: {file.chunking_strategy.type}
                              {file.chunking_strategy.static && (
                                <span className="ml-2">
                                  (Max: {file.chunking_strategy.static.max_chunk_size_tokens} tokens,
                                  Overlap: {file.chunking_strategy.static.chunk_overlap_tokens} tokens)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {pagination.hasMore && (
                      <div className="text-center pt-4">
                        <Button
                          onClick={handleLoadMore}
                          disabled={vectorStoreLoading}
                          variant="outline"
                        >
                          {vectorStoreLoading ? 'Loading...' : 'Load More'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

const SettingsPage: React.FC = () => {
  // Initialize tab state from localStorage, default to 'control_chart'
  const [activeTab, setActiveTab] = useState<ChatbotType>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('hthgse-settings-active-tab')
      if (savedTab === 'control_chart' || savedTab === 'planned_experiment') {
        return savedTab as ChatbotType
      }
    }
    return 'control_chart'
  })

  // Save tab state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hthgse-settings-active-tab', activeTab)
    }
  }, [activeTab])

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('control_chart')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'control_chart'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Control Chart Generator
            </button>
            <button
              onClick={() => setActiveTab('planned_experiment')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'planned_experiment'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Planned Experiment Generator
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'control_chart' && (
          <SettingsTabContent key="control_chart" id={1} />
        )}
        {activeTab === 'planned_experiment' && (
          <SettingsTabContent key="planned_experiment" id={2} />
        )}
      </div>
    </div>
  )
}

export default SettingsPage
