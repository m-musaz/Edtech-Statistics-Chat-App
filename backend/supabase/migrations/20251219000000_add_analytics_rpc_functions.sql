-- Migration: Add RPC functions for optimized analytics queries
-- These functions perform all computation at the database level, avoiding N+1 queries

-- ============================================================================
-- Function: get_latency_analytics
-- Returns latency analytics with summary statistics and time series data
-- ============================================================================

DROP FUNCTION IF EXISTS get_latency_analytics(bigint, timestamp, timestamp, text);

CREATE OR REPLACE FUNCTION get_latency_analytics(
    p_admin_settings_id bigint DEFAULT NULL,
    p_from_date timestamp without time zone DEFAULT NULL,
    p_to_date timestamp without time zone DEFAULT NULL,
    p_granularity text DEFAULT 'day'
)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_analytics AS (
        SELECT 
            a.latency_ms,
            a.created_at
        FROM analytics a
        JOIN messages m ON a.message_id = m.id
        JOIN threads t ON m.thread_id = t.id
        WHERE 
            (p_admin_settings_id IS NULL OR t.admin_settings_id = p_admin_settings_id)
            AND (p_from_date IS NULL OR a.created_at >= p_from_date)
            AND (p_to_date IS NULL OR a.created_at <= p_to_date)
            AND a.latency_ms IS NOT NULL
    ),
    overall_stats AS (
        SELECT 
            COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms), 0) as p50,
            COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY latency_ms), 0) as p90,
            COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms), 0) as p99,
            COALESCE(avg(latency_ms), 0) as mean
        FROM filtered_analytics
    ),
    time_series AS (
        SELECT 
            CASE p_granularity
                WHEN 'hour' THEN to_char(date_trunc('hour', fa.created_at), 'YYYY-MM-DD HH24:00')
                WHEN 'day' THEN to_char(date_trunc('day', fa.created_at), 'YYYY-MM-DD')
                WHEN 'week' THEN to_char(date_trunc('week', fa.created_at), 'YYYY-MM-DD')
                WHEN 'month' THEN to_char(date_trunc('month', fa.created_at), 'YYYY-MM')
                WHEN 'year' THEN to_char(date_trunc('year', fa.created_at), 'YYYY')
                ELSE to_char(date_trunc('day', fa.created_at), 'YYYY-MM-DD')
            END as ts,
            round(avg(fa.latency_ms)::numeric, 2) as avg_ms,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY fa.latency_ms) as p90_ms,
            count(*) as count
        FROM filtered_analytics fa
        GROUP BY ts
        ORDER BY ts
    )
    SELECT json_build_object(
        'summary', (
            SELECT json_build_object(
                'p50_ms', round(p50::numeric),
                'p90_ms', round(p90::numeric),
                'p99_ms', round(p99::numeric),
                'mean_ms', round(mean::numeric, 2)
            )
            FROM overall_stats
        ),
        'series', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'ts', ts,
                    'avg_ms', avg_ms,
                    'p90_ms', round(p90_ms::numeric),
                    'count', count
                )
                ORDER BY ts
            ) FROM time_series),
            '[]'::json
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_latency_analytics(bigint, timestamp, timestamp, text) TO anon, authenticated;

-- ============================================================================
-- Function: get_cost_analytics
-- Returns cost analytics with totals and time series data
-- ============================================================================

DROP FUNCTION IF EXISTS get_cost_analytics(bigint, timestamp, timestamp, text);

CREATE OR REPLACE FUNCTION get_cost_analytics(
    p_admin_settings_id bigint DEFAULT NULL,
    p_from_date timestamp without time zone DEFAULT NULL,
    p_to_date timestamp without time zone DEFAULT NULL,
    p_granularity text DEFAULT 'day'
)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_analytics AS (
        SELECT 
            a.cost_usd,
            a.input_tokens,
            a.output_tokens,
            a.created_at
        FROM analytics a
        JOIN messages m ON a.message_id = m.id
        JOIN threads t ON m.thread_id = t.id
        WHERE 
            (p_admin_settings_id IS NULL OR t.admin_settings_id = p_admin_settings_id)
            AND (p_from_date IS NULL OR a.created_at >= p_from_date)
            AND (p_to_date IS NULL OR a.created_at <= p_to_date)
    ),
    totals AS (
        SELECT 
            COALESCE(sum(cost_usd), 0) as total_usd,
            COALESCE(sum(input_tokens), 0) as total_input_tokens,
            COALESCE(sum(output_tokens), 0) as total_output_tokens
        FROM filtered_analytics
    ),
    time_series AS (
        SELECT 
            CASE p_granularity
                WHEN 'hour' THEN to_char(date_trunc('hour', fa.created_at), 'YYYY-MM-DD HH24:00')
                WHEN 'day' THEN to_char(date_trunc('day', fa.created_at), 'YYYY-MM-DD')
                WHEN 'week' THEN to_char(date_trunc('week', fa.created_at), 'YYYY-MM-DD')
                WHEN 'month' THEN to_char(date_trunc('month', fa.created_at), 'YYYY-MM')
                WHEN 'year' THEN to_char(date_trunc('year', fa.created_at), 'YYYY')
                ELSE to_char(date_trunc('day', fa.created_at), 'YYYY-MM-DD')
            END as ts,
            round(COALESCE(sum(fa.cost_usd), 0)::numeric, 2) as usd,
            COALESCE(sum(fa.input_tokens), 0) as input_tokens,
            COALESCE(sum(fa.output_tokens), 0) as output_tokens
        FROM filtered_analytics fa
        GROUP BY ts
        ORDER BY ts
    )
    SELECT json_build_object(
        'total_usd', (SELECT round(total_usd::numeric, 2) FROM totals),
        'total_input_tokens', (SELECT total_input_tokens FROM totals),
        'total_output_tokens', (SELECT total_output_tokens FROM totals),
        'series', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'ts', ts,
                    'usd', usd,
                    'input_tokens', input_tokens,
                    'output_tokens', output_tokens
                )
                ORDER BY ts
            ) FROM time_series),
            '[]'::json
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_cost_analytics(bigint, timestamp, timestamp, text) TO anon, authenticated;

-- ============================================================================
-- Function: get_charts_analytics
-- Returns chart generation analytics with rate, breakdown by type, and time series
-- ============================================================================

DROP FUNCTION IF EXISTS get_charts_analytics(bigint, timestamp, timestamp, text);

CREATE OR REPLACE FUNCTION get_charts_analytics(
    p_admin_settings_id bigint DEFAULT NULL,
    p_from_date timestamp without time zone DEFAULT NULL,
    p_to_date timestamp without time zone DEFAULT NULL,
    p_granularity text DEFAULT 'day'
)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_analytics AS (
        SELECT 
            a.chart_type,
            a.created_at
        FROM analytics a
        JOIN messages m ON a.message_id = m.id
        JOIN threads t ON m.thread_id = t.id
        WHERE 
            (p_admin_settings_id IS NULL OR t.admin_settings_id = p_admin_settings_id)
            AND (p_from_date IS NULL OR a.created_at >= p_from_date)
            AND (p_to_date IS NULL OR a.created_at <= p_to_date)
    ),
    rate_calc AS (
        SELECT 
            count(*) as total_messages,
            count(*) FILTER (WHERE chart_type IS NOT NULL AND chart_type != 'none') as chart_messages
        FROM filtered_analytics
    ),
    by_type AS (
        SELECT 
            chart_type,
            count(*) as count
        FROM filtered_analytics
        WHERE chart_type IS NOT NULL AND chart_type != 'none'
        GROUP BY chart_type
        ORDER BY count DESC
    ),
    time_series AS (
        SELECT 
            CASE p_granularity
                WHEN 'hour' THEN to_char(date_trunc('hour', fa.created_at), 'YYYY-MM-DD HH24:00')
                WHEN 'day' THEN to_char(date_trunc('day', fa.created_at), 'YYYY-MM-DD')
                WHEN 'week' THEN to_char(date_trunc('week', fa.created_at), 'YYYY-MM-DD')
                WHEN 'month' THEN to_char(date_trunc('month', fa.created_at), 'YYYY-MM')
                WHEN 'year' THEN to_char(date_trunc('year', fa.created_at), 'YYYY')
                ELSE to_char(date_trunc('day', fa.created_at), 'YYYY-MM-DD')
            END as ts,
            count(*) FILTER (WHERE fa.chart_type IS NOT NULL AND fa.chart_type != 'none') as generated,
            count(*) as total
        FROM filtered_analytics fa
        GROUP BY ts
        ORDER BY ts
    )
    SELECT json_build_object(
        'rate', json_build_object(
            'generated_pct', (
                SELECT 
                    CASE 
                        WHEN total_messages > 0 THEN round((chart_messages::numeric / total_messages * 100)::numeric, 1)
                        ELSE 0
                    END
                FROM rate_calc
            )
        ),
        'by_type', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'chart_type', chart_type,
                    'count', count
                )
            ) FROM by_type),
            '[]'::json
        ),
        'series', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'ts', ts,
                    'generated', generated,
                    'total', total
                )
                ORDER BY ts
            ) FROM time_series),
            '[]'::json
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_charts_analytics(bigint, timestamp, timestamp, text) TO anon, authenticated;

-- ============================================================================
-- Function: get_usage_analytics
-- Returns usage analytics including chats per user, session length, and active users
-- ============================================================================

DROP FUNCTION IF EXISTS get_usage_analytics(bigint, timestamp, timestamp, text);

CREATE OR REPLACE FUNCTION get_usage_analytics(
    p_admin_settings_id bigint DEFAULT NULL,
    p_from_date timestamp without time zone DEFAULT NULL,
    p_to_date timestamp without time zone DEFAULT NULL,
    p_granularity text DEFAULT 'day'
)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_threads AS (
        SELECT 
            t.id,
            t.user_id,
            t.created_at
        FROM threads t
        WHERE 
            (p_admin_settings_id IS NULL OR t.admin_settings_id = p_admin_settings_id)
            AND (p_from_date IS NULL OR t.created_at >= p_from_date)
            AND (p_to_date IS NULL OR t.created_at <= p_to_date)
    ),
    filtered_messages AS (
        SELECT 
            m.user_id,
            m.created_at,
            m.content,
            m.thread_id
        FROM messages m
        JOIN threads t ON m.thread_id = t.id
        WHERE 
            m.role = 'user'
            AND (p_admin_settings_id IS NULL OR t.admin_settings_id = p_admin_settings_id)
            AND (p_from_date IS NULL OR m.created_at >= p_from_date)
            AND (p_to_date IS NULL OR m.created_at <= p_to_date)
    ),
    chats_per_user AS (
        SELECT 
            user_id,
            count(*) as threads
        FROM filtered_threads
        GROUP BY user_id
    ),
    session_metrics AS (
        SELECT 
            count(*) as total_messages,
            -- Estimate word count from content (handle JSON text field)
            sum(
                CASE 
                    WHEN content IS NULL THEN 0
                    WHEN content::jsonb ? 'text' 
                        THEN COALESCE(array_length(string_to_array(content::jsonb->>'text', ' '), 1), 0)
                    ELSE COALESCE(array_length(string_to_array(content::text, ' '), 1), 0)
                END
            ) as total_words,
            -- Estimate sessions (simplified: count distinct user-day combinations)
            count(DISTINCT (user_id, date_trunc('day', created_at))) as estimated_sessions
        FROM filtered_messages
    ),
    active_users_by_period AS (
        SELECT 
            CASE p_granularity
                WHEN 'hour' THEN to_char(date_trunc('hour', m.created_at), 'YYYY-MM-DD HH24:00')
                WHEN 'day' THEN to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD')
                WHEN 'week' THEN to_char(date_trunc('week', m.created_at), 'YYYY-MM-DD')
                WHEN 'month' THEN to_char(date_trunc('month', m.created_at), 'YYYY-MM')
                WHEN 'year' THEN to_char(date_trunc('year', m.created_at), 'YYYY')
                ELSE to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD')
            END as ts,
            count(DISTINCT m.user_id) as active_users
        FROM filtered_messages m
        GROUP BY ts
        ORDER BY ts
    )
    SELECT json_build_object(
        'chats_per_user', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'user_id', user_id,
                    'threads', threads
                )
            ) FROM chats_per_user),
            '[]'::json
        ),
        'avg_session_length', (
            SELECT json_build_object(
                'messages_per_session', 
                    CASE 
                        WHEN estimated_sessions > 0 THEN round((total_messages::numeric / estimated_sessions)::numeric, 1)
                        ELSE 0
                    END,
                'words_per_session',
                    CASE 
                        WHEN estimated_sessions > 0 THEN round((COALESCE(total_words, 0)::numeric / estimated_sessions)::numeric, 1)
                        ELSE 0
                    END
            )
            FROM session_metrics
        ),
        'active_users', COALESCE(
            (SELECT json_agg(
                CASE p_granularity
                    WHEN 'day' THEN json_build_object('ts', ts, 'daily_active_users', active_users)
                    WHEN 'week' THEN json_build_object('ts', ts, 'week_active_users', active_users)
                    WHEN 'month' THEN json_build_object('ts', ts, 'month_active_users', active_users)
                    WHEN 'year' THEN json_build_object('ts', ts, 'year_active_users', active_users)
                    ELSE json_build_object('ts', ts, 'daily_active_users', active_users)
                END
                ORDER BY ts
            ) FROM active_users_by_period),
            '[]'::json
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_usage_analytics(bigint, timestamp, timestamp, text) TO anon, authenticated;

-- ============================================================================
-- Function: get_recent_latencies
-- Returns the most recent latencies with status indicators
-- ============================================================================

DROP FUNCTION IF EXISTS get_recent_latencies(bigint, int);

CREATE OR REPLACE FUNCTION get_recent_latencies(
    p_admin_settings_id bigint DEFAULT NULL,
    p_limit int DEFAULT 20
)
RETURNS json AS $$
DECLARE
    result json;
    actual_limit int;
BEGIN
    actual_limit := LEAST(GREATEST(p_limit, 1), 50);

    WITH filtered_analytics AS (
        SELECT 
            a.created_at,
            a.latency_ms,
            a.message_id
        FROM analytics a
        JOIN messages m ON a.message_id = m.id
        JOIN threads t ON m.thread_id = t.id
        WHERE 
            (p_admin_settings_id IS NULL OR t.admin_settings_id = p_admin_settings_id)
            AND a.latency_ms IS NOT NULL
        ORDER BY a.created_at DESC
        LIMIT actual_limit
    ),
    numbered_results AS (
        SELECT 
            row_number() OVER (ORDER BY created_at DESC) as id,
            created_at as timestamp,
            latency_ms as latency,
            CASE 
                WHEN latency_ms < 100 THEN 'success'
                WHEN latency_ms < 300 THEN 'warning'
                ELSE 'error'
            END as status,
            message_id
        FROM filtered_analytics
    )
    SELECT json_build_object(
        'recent_latencies', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', id,
                    'timestamp', timestamp,
                    'latency', latency,
                    'status', status,
                    'message_id', message_id
                )
                ORDER BY id
            ) FROM numbered_results),
            '[]'::json
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_recent_latencies(bigint, int) TO anon, authenticated;

-- ============================================================================
-- Add indexes to optimize the joins (if not already exist)
-- ============================================================================

-- Index on analytics.message_id for faster joins
CREATE INDEX IF NOT EXISTS idx_analytics_message_id ON analytics(message_id);

-- Index on messages.thread_id for faster joins
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- Index on analytics.created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

-- Index on messages.created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Index on messages.role for filtering user messages
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- Composite index for common filter pattern on threads
CREATE INDEX IF NOT EXISTS idx_threads_admin_settings_created ON threads(admin_settings_id, created_at);
