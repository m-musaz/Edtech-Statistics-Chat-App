
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Clock, DollarSign, Zap, BarChart3, Users, MessageSquare, Activity, AlertCircle, RefreshCw } from "lucide-react"
import { getLatencyAnalytics, LatencyAnalytics, getCostAnalytics, CostAnalytics, getChartAnalytics, ChartAnalytics, getUsageAnalytics, UsageAnalytics, getRecentLatencies, RecentLatency } from "@/lib/api"

type ChatbotType = 'control_chart' | 'planned_experiment'
type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly'

// Cache entry for a specific tab + time filter combination
interface AnalyticsCacheEntry {
  latency: LatencyAnalytics | null
  cost: CostAnalytics | null
  charts: ChartAnalytics | null
  usage: UsageAnalytics | null
  recentLatencies: RecentLatency[]
  // Transformed data for charts
  latencyData: any[]
  costData: any[]
  chartData: any[]
  activeUsersData: any[]
  userEngagementData: any[]
}

// Full cache structure
interface AnalyticsCache {
  control_chart: {
    daily?: AnalyticsCacheEntry
    weekly?: AnalyticsCacheEntry
    monthly?: AnalyticsCacheEntry
    yearly?: AnalyticsCacheEntry
  }
  planned_experiment: {
    daily?: AnalyticsCacheEntry
    weekly?: AnalyticsCacheEntry
    monthly?: AnalyticsCacheEntry
    yearly?: AnalyticsCacheEntry
  }
}

// Initial empty cache
const createEmptyCache = (): AnalyticsCache => ({
  control_chart: {},
  planned_experiment: {}
})

// Transform latency data for chart
const transformLatencyData = (analytics: LatencyAnalytics) => {
  if (!analytics.series.length) return []
  
  return analytics.series.map(point => ({
    time: formatDate(point.ts),
    latency: Math.round(point.avg_ms),
    avgLatency: Math.round(analytics.summary.mean_ms),
    p90: point.p90_ms,
    count: point.count
  }))
}

// Transform cost data for chart
const transformCostData = (analytics: CostAnalytics) => {
  if (!analytics.series.length) return []
  
  return analytics.series.map(point => ({
    date: formatDate(point.ts),
    cost: point.usd,
    inputTokens: point.input_tokens,
    outputTokens: point.output_tokens,
  }))
}

// Transform chart data for visualization
const transformChartData = (analytics: ChartAnalytics) => {
  if (!analytics.by_type.length) return []
  
  // Filter out 'none' - only show actual chart types
  const actualCharts = analytics.by_type.filter(item => item.chart_type !== 'none')
  
  if (actualCharts.length === 0) return []
  
  // Map chart types to colors
  const colorMap: { [key: string]: string } = {
    'line': '#60a5fa',
    'bar': '#3b82f6', 
    'pie': '#1d4ed8',
    'area': '#1e40af',
    'scatter': '#1e3a8a',
  }
  
  return actualCharts.map(item => ({
    type: item.chart_type.charAt(0).toUpperCase() + item.chart_type.slice(1),
    count: item.count,
    color: colorMap[item.chart_type] || '#6b7280'
  }))
}

// Transform usage data for charts
const transformActiveUsersData = (analytics: UsageAnalytics, granularity: string = 'daily') => {
  if (!analytics.active_users.length) return []
  
  // Determine the correct field based on granularity
  const getActiveUsersField = (point: any) => {
    switch (granularity) {
      case 'daily':
        return point.daily_active_users || 0
      case 'weekly':
        return point.week_active_users || 0
      case 'monthly':
        return point.month_active_users || 0
      case 'yearly':
        return point.year_active_users || 0
      default:
        return point.daily_active_users || 0
    }
  }
  
  return analytics.active_users.map(point => ({
    date: formatDate(point.ts),
    activeUsers: getActiveUsersField(point)
  }))
}

// Transform user engagement data for distribution chart
const transformUserEngagementData = (analytics: UsageAnalytics) => {
  if (!analytics.chats_per_user.length) return []
  
  // Count how many users have each number of chats
  const distribution: { [key: number]: number } = {}
  analytics.chats_per_user.forEach(user => {
    const chats = user.threads
    distribution[chats] = (distribution[chats] || 0) + 1
  })
  
  // Convert to chart data format
  return Object.entries(distribution)
    .map(([chats, userCount]) => ({
      chats: parseInt(chats),
      users: userCount,
      label: `${chats} chat${parseInt(chats) === 1 ? '' : 's'}`
    }))
    .sort((a, b) => a.chats - b.chats)
}

// Format date for display based on granularity
const formatDate = (dateString: string) => {
  // Handle different time formats
  if (dateString.includes(' ')) {
    // Hour format: "2025-09-18 06:00"
    const parts = dateString.split(' ')
    if (parts.length >= 2) {
      const datePart = parts[0]!
      const timePart = parts[1]!
      const date = new Date(datePart)
      const hourParts = timePart.split(':')
      const hour = hourParts[0]!
      return `${date.getMonth() + 1}/${date.getDate()} ${hour}:00`
    }
    return dateString
  } else if (dateString.length === 4) {
    // Year format: "2025"
    return dateString
  } else if (dateString.length === 7) {
    // Month format: "2025-09"
    const parts = dateString.split('-')
    if (parts.length >= 2) {
      const year = parts[0]!
      const month = parts[1]!
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
    return dateString
  } else {
    // Day/Week format: "2025-09-18"
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

// Map time filter to granularity and date range
const getAnalyticsParams = (timeFilter: string): { from_date: string; to_date: string; granularity: 'hour' | 'day' | 'week' | 'month' | 'year' } => {
  // Use UTC to avoid timezone issues
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  
  let fromDate: Date
  let granularity: 'hour' | 'day' | 'week' | 'month' | 'year'
  
  switch (timeFilter) {
    case 'daily':
      fromDate = new Date(todayUTC)
      fromDate.setUTCDate(todayUTC.getUTCDate() - 7) // Past 7 days
      granularity = 'day' // Daily data points
      break
    case 'weekly':
      fromDate = new Date(todayUTC)
      fromDate.setUTCDate(todayUTC.getUTCDate() - 28) // Past 4 weeks (28 days)
      granularity = 'week' // Weekly data points
      break
    case 'monthly':
      fromDate = new Date(todayUTC)
      fromDate.setUTCMonth(todayUTC.getUTCMonth() - 12) // Past 12 months
      granularity = 'month' // Monthly data points
      break
    case 'yearly':
      fromDate = new Date(todayUTC)
      fromDate.setUTCFullYear(todayUTC.getUTCFullYear() - 10) // Go back 10 years for all available yearly data
      granularity = 'year' // Yearly data points
      break
    default: // fallback to daily
      fromDate = new Date(todayUTC)
      fromDate.setUTCDate(todayUTC.getUTCDate() - 7) // Past 7 days
      granularity = 'day' // Daily data points
      break
  }
  
  // Format dates consistently using UTC
  const fromDateStr = fromDate.getUTCFullYear() + '-' + 
    String(fromDate.getUTCMonth() + 1).padStart(2, '0') + '-' + 
    String(fromDate.getUTCDate()).padStart(2, '0')
  
  // Add 1 day to include today's data in the range
  const tomorrowUTC = new Date(todayUTC)
  tomorrowUTC.setUTCDate(todayUTC.getUTCDate() + 1)
  
  const toDateStr = tomorrowUTC.getUTCFullYear() + '-' + 
    String(tomorrowUTC.getUTCMonth() + 1).padStart(2, '0') + '-' + 
    String(tomorrowUTC.getUTCDate()).padStart(2, '0')
  
  const params = {
    from_date: fromDateStr,
    to_date: toDateStr,
    granularity
  }
  
  return params
}

export default function AdminDashboard() {
  // Initialize tab state from localStorage, default to 'control_chart'
  const [activeTab, setActiveTab] = useState<ChatbotType>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('hthgse-dashboard-active-tab')
      if (savedTab === 'control_chart' || savedTab === 'planned_experiment') {
        return savedTab as ChatbotType
      }
    }
    return 'control_chart'
  })

  // Save tab state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hthgse-dashboard-active-tab', activeTab)
    }
  }, [activeTab])

  // Get admin_settings_id based on active tab (1 for control, 2 for plan)
  const adminSettingsId = activeTab === 'control_chart' ? 1 : 2

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily")

  // Analytics cache
  const [cache, setCache] = useState<AnalyticsCache>(createEmptyCache)

  // Current display state (derived from cache or loading)
  const [latencyData, setLatencyData] = useState<any[]>([])
  const [latencyAnalytics, setLatencyAnalytics] = useState<LatencyAnalytics | null>(null)
  const [isLoadingLatency, setIsLoadingLatency] = useState(true)
  const [latencyError, setLatencyError] = useState<string | null>(null)

  // Cost analytics state
  const [costData, setCostData] = useState<any[]>([])
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics | null>(null)
  const [isLoadingCost, setIsLoadingCost] = useState(true)
  const [costError, setCostError] = useState<string | null>(null)

  // Chart analytics state
  const [chartData, setChartData] = useState<any[]>([])
  const [chartAnalytics, setChartAnalytics] = useState<ChartAnalytics | null>(null)
  const [isLoadingChart, setIsLoadingChart] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)

  // Usage analytics state
  const [activeUsersData, setActiveUsersData] = useState<any[]>([])
  const [userEngagementData, setUserEngagementData] = useState<any[]>([])
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [usageError, setUsageError] = useState<string | null>(null)

  // Recent latencies state
  const [recentLatencies, setRecentLatencies] = useState<RecentLatency[]>([])
  const [isLoadingRecentLatencies, setIsLoadingRecentLatencies] = useState(true)
  const [recentLatenciesError, setRecentLatenciesError] = useState<string | null>(null)

  // Loading state for refresh button
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if cache exists for current tab + time filter
  const getCachedData = useCallback((): AnalyticsCacheEntry | undefined => {
    return cache[activeTab]?.[timeFilter]
  }, [cache, activeTab, timeFilter])

  // Update cache with new data
  const updateCache = useCallback((entry: AnalyticsCacheEntry) => {
    setCache(prevCache => ({
      ...prevCache,
      [activeTab]: {
        ...prevCache[activeTab],
        [timeFilter]: entry
      }
    }))
  }, [activeTab, timeFilter])

  // Apply cached data to display state
  const applyCachedData = useCallback((cachedEntry: AnalyticsCacheEntry) => {
    setLatencyAnalytics(cachedEntry.latency)
    setLatencyData(cachedEntry.latencyData)
    setCostAnalytics(cachedEntry.cost)
    setCostData(cachedEntry.costData)
    setChartAnalytics(cachedEntry.charts)
    setChartData(cachedEntry.chartData)
    setUsageAnalytics(cachedEntry.usage)
    setActiveUsersData(cachedEntry.activeUsersData)
    setUserEngagementData(cachedEntry.userEngagementData)
    setRecentLatencies(cachedEntry.recentLatencies)

    // Clear loading states
    setIsLoadingLatency(false)
    setIsLoadingCost(false)
    setIsLoadingChart(false)
    setIsLoadingUsage(false)
    setIsLoadingRecentLatencies(false)

    // Clear errors
    setLatencyError(null)
    setCostError(null)
    setChartError(null)
    setUsageError(null)
    setRecentLatenciesError(null)
  }, [])

  // Fetch all analytics data
  const fetchAllAnalytics = useCallback(async (forceRefresh: boolean = false) => {
    // Check cache first (unless forcing refresh)
    const cachedData = getCachedData()
    if (cachedData && !forceRefresh) {
      applyCachedData(cachedData)
      return
    }

    // Set loading states
    setIsLoadingLatency(true)
    setIsLoadingCost(true)
    setIsLoadingChart(true)
    setIsLoadingUsage(true)
    setIsLoadingRecentLatencies(true)

    // Clear errors
    setLatencyError(null)
    setCostError(null)
    setChartError(null)
    setUsageError(null)
    setRecentLatenciesError(null)

    const analyticsParams = getAnalyticsParams(timeFilter)
    const currentTimeFilter = timeFilter // Capture for transforms

    // Fetch all data in parallel
    const [latencyResult, costResult, chartsResult, usageResult, recentLatenciesResult] = await Promise.allSettled([
      getLatencyAnalytics({ ...analyticsParams, admin_settings_id: adminSettingsId }),
      getCostAnalytics({ ...analyticsParams, admin_settings_id: adminSettingsId }),
      getChartAnalytics({ ...analyticsParams, admin_settings_id: adminSettingsId }),
      getUsageAnalytics({ ...analyticsParams, admin_settings_id: adminSettingsId }),
      getRecentLatencies(20, adminSettingsId)
    ])

    // Process results
    let latency: LatencyAnalytics | null = null
    let latencyDataTransformed: any[] = []
    if (latencyResult.status === 'fulfilled') {
      latency = latencyResult.value
      latencyDataTransformed = transformLatencyData(latency)
      setLatencyAnalytics(latency)
      setLatencyData(latencyDataTransformed)
    } else {
      setLatencyError(latencyResult.reason?.message || 'Failed to fetch latency data')
    }
    setIsLoadingLatency(false)

    let cost: CostAnalytics | null = null
    let costDataTransformed: any[] = []
    if (costResult.status === 'fulfilled') {
      cost = costResult.value
      costDataTransformed = transformCostData(cost)
      setCostAnalytics(cost)
      setCostData(costDataTransformed)
    } else {
      setCostError(costResult.reason?.message || 'Failed to fetch cost data')
    }
    setIsLoadingCost(false)

    let charts: ChartAnalytics | null = null
    let chartDataTransformed: any[] = []
    if (chartsResult.status === 'fulfilled') {
      charts = chartsResult.value
      chartDataTransformed = transformChartData(charts)
      setChartAnalytics(charts)
      setChartData(chartDataTransformed)
    } else {
      setChartError(chartsResult.reason?.message || 'Failed to fetch chart data')
    }
    setIsLoadingChart(false)

    let usage: UsageAnalytics | null = null
    let activeUsersDataTransformed: any[] = []
    let userEngagementDataTransformed: any[] = []
    if (usageResult.status === 'fulfilled') {
      usage = usageResult.value
      activeUsersDataTransformed = transformActiveUsersData(usage, currentTimeFilter)
      userEngagementDataTransformed = transformUserEngagementData(usage)
      setUsageAnalytics(usage)
      setActiveUsersData(activeUsersDataTransformed)
      setUserEngagementData(userEngagementDataTransformed)
    } else {
      setUsageError(usageResult.reason?.message || 'Failed to fetch usage data')
    }
    setIsLoadingUsage(false)

    let recentLatenciesData: RecentLatency[] = []
    if (recentLatenciesResult.status === 'fulfilled') {
      recentLatenciesData = recentLatenciesResult.value.recent_latencies
      setRecentLatencies(recentLatenciesData)
    } else {
      setRecentLatenciesError(recentLatenciesResult.reason?.message || 'Failed to fetch recent latencies')
    }
    setIsLoadingRecentLatencies(false)

    // Store in cache
    const cacheEntry: AnalyticsCacheEntry = {
      latency,
      cost,
      charts,
      usage,
      recentLatencies: recentLatenciesData,
      latencyData: latencyDataTransformed,
      costData: costDataTransformed,
      chartData: chartDataTransformed,
      activeUsersData: activeUsersDataTransformed,
      userEngagementData: userEngagementDataTransformed
    }
    updateCache(cacheEntry)
  }, [activeTab, timeFilter, adminSettingsId, getCachedData, applyCachedData, updateCache])

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAllAnalytics(true) // Force refresh
    setIsRefreshing(false)
  }

  // Fetch data when tab or time filter changes
  useEffect(() => {
    fetchAllAnalytics(false)
  }, [fetchAllAnalytics])

  const totalCost = costAnalytics?.total_usd || 0
  const avgLatency = latencyAnalytics?.summary.mean_ms || (latencyData.length > 0 ? latencyData.reduce((sum, point) => sum + point.latency, 0) / latencyData.length : 0)
  const totalCharts = chartAnalytics ? chartAnalytics.by_type.filter(chart => chart.chart_type !== 'none').reduce((sum, chart) => sum + chart.count, 0) : 0
  const totalTokens = costAnalytics ? (costAnalytics.total_input_tokens + costAnalytics.total_output_tokens) : 0
  const totalRequests = latencyAnalytics?.series.reduce((sum, point) => sum + point.count, 0) || 0
  const avgTokensPerRequest = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0

  const avgChatsPerUser = usageAnalytics ? 
    usageAnalytics.chats_per_user.reduce((sum, user) => sum + user.threads, 0) / usageAnalytics.chats_per_user.length : 0
  const avgMessagesPerSession = usageAnalytics?.avg_session_length.messages_per_session || 0
  const avgWordsPerSession = usageAnalytics?.avg_session_length.words_per_session || 0
  
  // Get active users based on selected time granularity
  const getActiveUsersForPeriod = () => {
    if (!usageAnalytics || !usageAnalytics.active_users.length) return 0
    
    const latestEntry = usageAnalytics.active_users[usageAnalytics.active_users.length - 1]
    
    // Get the appropriate field based on granularity
    switch (timeFilter) {
      case 'daily':
        return latestEntry?.daily_active_users || 0
      case 'weekly':
        return latestEntry?.week_active_users || 0
      case 'monthly':
        return latestEntry?.month_active_users || 0
      case 'yearly':
        return latestEntry?.year_active_users || 0
      default:
        return latestEntry?.daily_active_users || 0
    }
  }
  
  const currentActiveUsers = getActiveUsersForPeriod()
  
  // Get time period label for display
  const getTimePeriodLabel = () => {
    switch (timeFilter) {
      case 'daily': return 'today'
      case 'weekly': return 'this week'
      case 'monthly': return 'this month'  
      case 'yearly': return 'this year'
      default: return 'today'
    }
  }
  
  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Tabs */}
        <div className="border-b border-border">
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

        {/* Controls row under tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Time Filter */}
            <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Average Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{Math.round(avgLatency)}ms</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Total API Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">${totalCost.toFixed(2)}</div>
              
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Total Tokens</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{(totalTokens / 1000).toFixed(1)}K</div>
              
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Charts Generated</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{totalCharts}</div>
              
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Chats per User</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{avgChatsPerUser.toFixed(1)}</div>
              
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Session Length</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{avgMessagesPerSession.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">{avgWordsPerSession.toFixed(0)} words avg</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{currentActiveUsers?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Users who made messages {getTimePeriodLabel()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Latency Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Response Latency</CardTitle>
              <CardDescription>
                {isLoadingLatency 
                  ? "Loading latency data..." 
                  : `${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)} latency trends`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLatency ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading latency data...</div>
                </div>
              ) : latencyError ? (
                <div className="h-[300px] flex items-center justify-center flex-col gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="text-sm text-red-500 text-center">
                    <div>Failed to load latency data</div>
                    <div className="text-xs text-muted-foreground mt-1">{latencyError}</div>
                  </div>
                </div>
              ) : latencyData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">No latency data available</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                      formatter={(value:any, name:any) => [
                        `${value}ms`, 
                        name === "latency" ? "Daily Avg Latency" : "Overall Avg Latency"
                      ]}
                  />
                    <Line type="monotone" dataKey="latency" stroke="#60a5fa" strokeWidth={2} name="latency" />
                  <Line
                    type="monotone"
                    dataKey="avgLatency"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                      name="avgLatency"
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* User Engagement Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">User Engagement</CardTitle>
              <CardDescription>
                {isLoadingUsage ? "Loading usage data..." : "Chats per user and session metrics"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsage ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading usage data...</div>
                </div>
              ) : usageError ? (
                <div className="h-[300px] flex items-center justify-center flex-col gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="text-sm text-red-500 text-center">
                    <div>Failed to load usage data</div>
                    <div className="text-xs text-muted-foreground mt-1">{usageError}</div>
                  </div>
                </div>
              ) : !usageAnalytics ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">No usage data available</div>
                </div>
               ) : userEngagementData.length === 0 ? (
                 <div className="h-[300px] flex items-center justify-center">
                   <div className="text-muted-foreground">No user engagement data available</div>
                 </div>
               ) : (
                 <div className="h-[300px]">
                   <div className="mb-4 grid grid-cols-3 gap-4 text-center">
                     <div>
                       <div className="text-2xl font-bold text-blue-500">{avgChatsPerUser.toFixed(1)}</div>
                       <div className="text-xs text-muted-foreground">Avg Chats per User</div>
                     </div>
                     <div>
                       <div className="text-2xl font-bold text-blue-600">{avgMessagesPerSession.toFixed(1)}</div>
                       <div className="text-xs text-muted-foreground">Messages per Session</div>
                     </div>
                     <div>
                       <div className="text-2xl font-bold text-blue-700">{Math.round(avgWordsPerSession)}</div>
                       <div className="text-xs text-muted-foreground">Words per Session</div>
                     </div>
                   </div>
                   <ResponsiveContainer width="100%" height={200}>
                     <BarChart data={userEngagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="label" 
                        stroke="hsl(var(--muted-foreground))" 
                        tick={{ fontSize: 12 }}
                      />
                       <YAxis 
                         stroke="hsl(var(--muted-foreground))" 
                         tick={{ fontSize: 12 }}
                         label={{ value: 'Users', angle: -90, position: 'insideLeft' }}
                       />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                         formatter={(value:any) => [`${value} users`, 'User Count']}
                       />
                       <Bar 
                         dataKey="users" 
                         fill="#60a5fa" 
                         radius={[4, 4, 0, 0]}
                         name="Users"
                       />
                     </BarChart>
              </ResponsiveContainer>
                 </div>
               )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Token Usage & Cost Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Token Usage & Cost</CardTitle>
              <CardDescription>
                {isLoadingCost ? "Loading cost data..." : "Input/Output tokens and associated costs"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCost ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading cost data...</div>
                </div>
              ) : costError ? (
                <div className="h-[300px] flex items-center justify-center flex-col gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="text-sm text-red-500 text-center">
                    <div>Failed to load cost data</div>
                    <div className="text-xs text-muted-foreground mt-1">{costError}</div>
                  </div>
                </div>
              ) : costData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">No cost data available</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="inputTokens"
                    stackId="1"
                    stroke="#60a5fa"
                    fill="#60a5fa"
                    fillOpacity={0.6}
                    name="Input Tokens"
                  />
                  <Area
                    type="monotone"
                    dataKey="outputTokens"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Output Tokens"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Active Users Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Active Users Over Time</CardTitle>
              <CardDescription>
                {isLoadingUsage ? "Loading usage data..." : `Users who sent messages, grouped by ${timeFilter.replace('ly', '').toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsage ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading usage data...</div>
                </div>
              ) : usageError ? (
                <div className="h-[300px] flex items-center justify-center flex-col gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="text-sm text-red-500 text-center">
                    <div>Failed to load usage data</div>
                    <div className="text-xs text-muted-foreground mt-1">{usageError}</div>
                  </div>
                </div>
              ) : activeUsersData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">No active users data available</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={activeUsersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="activeUsers"
                    stroke="#1d4ed8"
                    fill="#1d4ed8"
                    fillOpacity={0.4}
                    name="Active Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chart Types Distribution */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Chart Types Generated</CardTitle>
              <CardDescription>
                {isLoadingChart ? "Loading chart data..." : "Distribution of chart types created"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingChart ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading chart data...</div>
                </div>
              ) : chartError ? (
                <div className="h-[250px] flex items-center justify-center flex-col gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="text-sm text-red-500 text-center">
                    <div>Failed to load chart data</div>
                    <div className="text-xs text-muted-foreground mt-1">{chartError}</div>
                  </div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-muted-foreground">No chart data available</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="type" 
                    stroke="hsl(var(--muted-foreground))" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value:any) => [`${value}`, 'Chart Count']}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#60a5fa" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">API Costs</CardTitle>
              <CardDescription>
                {isLoadingCost ? "Loading cost data..." : `${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)} cost trends`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCost ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading cost data...</div>
                </div>
              ) : costError ? (
                <div className="h-[250px] flex items-center justify-center flex-col gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="text-sm text-red-500 text-center">
                    <div>Failed to load cost data</div>
                    <div className="text-xs text-muted-foreground mt-1">{costError}</div>
                  </div>
                </div>
              ) : costData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-muted-foreground">No cost data available</div>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                      formatter={(value:any) => [`$${Number(value).toFixed(3)}`, "Cost"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#1d4ed8"
                    strokeWidth={3}
                    dot={{ fill: "#1d4ed8", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Latencies */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">Recent Latencies</CardTitle>
              <CardDescription>
                {isLoadingRecentLatencies 
                  ? "Loading latest response times..." 
                  : `Latest ${recentLatencies.length} response times`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRecentLatencies ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading recent latencies...</div>
                </div>
              ) : recentLatenciesError ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-red-500 text-sm">Error: {recentLatenciesError}</div>
                </div>
              ) : recentLatencies.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-muted-foreground">No recent latencies available</div>
                </div>
              ) : (
                <div className="h-[200px] overflow-y-auto space-y-3 pr-2">
                  {recentLatencies.map((item) => {
                    // Format timestamp to show time only
                    const timeOnly = item.timestamp.includes('T') 
                      ? new Date(item.timestamp).toLocaleTimeString('en-US', { 
                          hour12: false, 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          second: '2-digit' 
                        })
                      : item.timestamp.split(" ")[1] || item.timestamp;
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              item.status === "success"
                                ? "bg-green-500"
                                : item.status === "warning"
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                          />
                          <span className="text-sm text-muted-foreground font-mono">{timeOnly}</span>
                        </div>
                        <Badge 
                          variant="default"
                          className={
                            item.latency < 5000 
                              ? "bg-green-500 hover:bg-green-600 text-white" 
                              : item.latency <= 10000 
                                ? "bg-orange-500 hover:bg-orange-600 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white"
                          }
                        >
                          {item.latency}ms
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">Performance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingLatency ? (
                <div className="flex items-center justify-center py-4">
                  <div className="text-sm text-muted-foreground">Loading...</div>
                </div>
              ) : latencyAnalytics ? (
                <>
              <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">P50 Response</span>
                    <span className="text-sm font-medium text-card-foreground">{Math.round(latencyAnalytics.summary.p50_ms)}ms</span>
              </div>
              <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">P90 Response</span>
                    <span className="text-sm font-medium text-card-foreground">{Math.round(latencyAnalytics.summary.p90_ms)}ms</span>
              </div>
              <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">P99 Response</span>
                    <span className="text-sm font-medium text-card-foreground">{Math.round(latencyAnalytics.summary.p99_ms)}ms</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <div className="text-sm text-muted-foreground">No data available</div>
              </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
            {isLoadingLatency || isLoadingCost ? (
              <div className="h-[120px] flex items-center justify-center">
                <div className="text-muted-foreground">Loading usage statistics...</div>
              </div>
            ) : (<><div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Requests</span>
                <span className="text-sm font-medium text-card-foreground">{totalRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Tokens/Request</span>
                <span className="text-sm font-medium text-card-foreground">{avgTokensPerRequest.toLocaleString()}</span>
              </div></>)}
              
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">Session Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Messages/Session</span>
                <span className="text-sm font-medium text-card-foreground">{avgMessagesPerSession.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Words/Session</span>
                <span className="text-sm font-medium text-card-foreground">{avgWordsPerSession.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">User Retention</span>
                <span className="text-sm font-medium text-green-500">87.3%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingCost ? (
                <div className="flex items-center justify-center py-4">
                  <div className="text-sm text-muted-foreground">Loading...</div>
                </div>
              ) : costAnalytics ? (
                <>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cost per 1K tokens</span>
                    <span className="text-sm font-medium text-card-foreground">
                      ${costAnalytics.total_input_tokens + costAnalytics.total_output_tokens > 0 
                        ? ((costAnalytics.total_usd / ((costAnalytics.total_input_tokens + costAnalytics.total_output_tokens) / 1000))).toFixed(3)
                        : '0.000'}
                    </span>
              </div>
              <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Input Tokens</span>
                    <span className="text-sm font-medium text-card-foreground">{costAnalytics.total_input_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Output Tokens</span>
                    <span className="text-sm font-medium text-card-foreground">{costAnalytics.total_output_tokens.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <div className="text-sm text-muted-foreground">No data available</div>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
