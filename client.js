window.__ModuleLoader__.load({
  id: '@local/mcp-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    /** Dictionary namespace owned by this plugin. */
    const NS = 'mcpPanel'
    /** The id shared by the sidebar entry and the main panel it opens. */
    const PANEL_ID = 'mcp'
    /** Module identifier every MCP server row is configured with. */
    const MCP_MODULE = '@deepseek-ai/dsh-mcp-client'
    /** Order slot: 0 is the Plugins entry, 10 the Schedules entry. */
    const PANEL_ORDER = 5
    /** How long a result notice stays visible. */
    const NOTICE_MS = 5000

    const zh = {
      'meta.title': 'MCP',
      'meta.description': '侧栏的 MCP 面板：列出本 profile 配置的所有 MCP 服务器，并可直接开关。',
      'panel': 'MCP',
      'title': 'MCP',
      'intro': '本 profile 配置的所有 MCP 服务器，每一条都是 @deepseek-ai/dsh-mcp-client 的一个实例。',
      'count': '{total} 台 · {on} 台已启用',
      'refresh': '刷新',
      'loading': '正在读取 MCP 服务器…',
      'error': '读取 MCP 列表失败：{message}',
      'retry': '重试',
      'empty.title': '还没有配置 MCP 服务器',
      'empty.hint': '在 profile 的 cordis.patch.yml 里 insert 一条 @deepseek-ai/dsh-mcp-client，每台服务器一条，serverName 唯一。',
      'state.off': '已停用',
      'phase.pending': '等待启动',
      'phase.loading': '启动中',
      'phase.active': '运行中',
      'phase.failed': '启动失败',
      'phase.unloading': '卸载中',
      'phase.none': '未运行',
      'locked.unaddressable': '该条目由更高优先级的配置层提供，profile patch 无法寻址，因此不能在面板里开关。',
      'locked.management': '该条目是管理自身所需，不能在面板里开关。',
      'toggle.label': '启用或停用 {name}',
      'notice.enabled': '已启用 {name}',
      'notice.disabled': '已停用 {name}',
      'notice.restart': '{name} 的改动已保存，重启后生效',
      'notice.overridden': '{name} 被更高优先级的配置层覆盖，开关不会生效',
      'notice.failed': '操作失败：{message}',
      'notice.busy': '正在应用 {name}…',
      'render.failed': '面板渲染失败：{message}',
      'hint': '工具以 mcp__<serverName>__<tool> 命名，下一条消息起即可调用；关闭后这些工具会从工具列表里消失。',
    }

    const en = {
      'meta.title': 'MCP',
      'meta.description': 'Sidebar MCP panel: lists every MCP server configured in this profile and switches each one.',
      'panel': 'MCP',
      'title': 'MCP',
      'intro': 'Every MCP server this profile configures. Each row is one @deepseek-ai/dsh-mcp-client entry.',
      'count': '{total} servers · {on} enabled',
      'refresh': 'Refresh',
      'loading': 'Reading MCP servers…',
      'error': 'Could not read the MCP list: {message}',
      'retry': 'Retry',
      'empty.title': 'No MCP server is configured yet',
      'empty.hint': 'Add one @deepseek-ai/dsh-mcp-client entry per server to the profile cordis.patch.yml, each with a unique serverName.',
      'state.off': 'Disabled',
      'phase.pending': 'Waiting to start',
      'phase.loading': 'Starting',
      'phase.active': 'Running',
      'phase.failed': 'Failed to start',
      'phase.unloading': 'Unloading',
      'phase.none': 'Not running',
      'locked.unaddressable': 'A higher-priority configuration layer provides this row, so the profile patch cannot address it and the panel cannot switch it.',
      'locked.management': 'This row is required to manage the app and cannot be switched here.',
      'toggle.label': 'Enable or disable {name}',
      'notice.enabled': 'Enabled {name}',
      'notice.disabled': 'Disabled {name}',
      'notice.restart': 'Saved the change to {name}; it takes effect after a restart',
      'notice.overridden': 'A higher-priority layer overrides {name}, so the switch does not take effect',
      'notice.failed': 'The change failed: {message}',
      'notice.busy': 'Applying {name}…',
      'render.failed': 'The panel could not render: {message}',
      'hint': 'Tools are named mcp__<serverName>__<tool> and become callable from the next message; disabling removes them from the tool list.',
    }

    const CSS = `
[data-mcp-panel]{box-sizing:border-box;height:100%;color:var(--dsw-alias-label-primary);flex-direction:column;align-items:center;gap:20px;padding:0 clamp(24px,4vw,48px) 48px;display:flex;overflow:auto}
[data-mcp-panel]>*{width:100%;max-width:960px}
.mp-head{box-sizing:border-box;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:16px;padding-top:28px;display:flex}
.mp-heading{min-width:0;max-width:100%}
.mp-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.mp-intro{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:13px;line-height:20px}
.mp-toolbar{white-space:nowrap;flex:none;justify-content:flex-end;align-items:center;gap:12px;display:flex}
.mp-count{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;font-variant-numeric:tabular-nums}
.mp-refresh{box-sizing:border-box;height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;cursor:pointer;transition:background .12s ease}
.mp-refresh:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.mp-refresh:disabled{cursor:progress;opacity:.6}
.mp-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.mp-notice{margin:0;padding:8px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.mp-notice[data-kind=ok]{color:var(--dsw-alias-state-business-primary)}
.mp-notice[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
.mp-status{margin:0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.mp-empty{display:flex;flex-direction:column;gap:6px;padding:16px 0}
.mp-empty h2{margin:0;font-size:14px;font-weight:500;line-height:22px}
.mp-empty p{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.mp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.mp-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.mp-glyph{width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.mp-row[data-state=on] .mp-glyph{color:var(--dsw-alias-brand-primary)}
.mp-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.mp-name{font-size:14px;font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-side{display:flex;align-items:center;gap:12px;flex:none}
.mp-state{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mp-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:none}
.mp-state[data-phase=active] .mp-dot{background:var(--dsw-alias-state-business-primary)}
.mp-state[data-phase=failed] .mp-dot{background:var(--dsw-alias-state-error-primary)}
.mp-state[data-phase=loading] .mp-dot,.mp-state[data-phase=pending] .mp-dot,.mp-state[data-phase=unloading] .mp-dot{background:var(--dsw-alias-state-warn-primary)}
.mp-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer}
.mp-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}
.mp-switch:disabled{cursor:default;opacity:.5}
.mp-switch:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:2px}
.mp-knob{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}
.mp-switch[aria-checked=false] .mp-knob{background:var(--dsw-alias-switch-thumb)}
.mp-switch[aria-checked=true] .mp-knob{transform:translate(16px)}
.mp-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.mp-hint code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-2)}
@media (prefers-reduced-motion:reduce){.mp-knob,.mp-switch,.mp-refresh{transition:none}}
`

    /** The sidebar glyph: a plug, drawn at the size the sidebar asks for. */
    function PanelIcon({ size }) {
      const edge = size ?? 16
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: 'M6 2v2.5M10 2v2.5' }),
        h('path', { d: 'M4.5 4.5h7v2.6a3.5 3.5 0 0 1-7 0z' }),
        h('path', { d: 'M8 10.6V14' }),
      )
    }

    /** The row glyph: the same plug, sized for a 28px chip. */
    function RowIcon() {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: 'M6 2v2.5M10 2v2.5' }),
        h('path', { d: 'M4.5 4.5h7v2.6a3.5 3.5 0 0 1-7 0z' }),
        h('path', { d: 'M8 10.6V14' }),
      )
    }

    /** Best-effort one-line diagnostic through the Host's route; never blocks the panel. */
    function diagnose(payload) {
      try {
        void fetch('/mcp-panel/loaded', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      } catch (error) {
        /* Diagnostics never block the panel. */
      }
    }

    /** A refusal keeps its diagnostic when the Host supplies one. */
    function describeFailure(error) {
      if (error === undefined || error === null) return 'unknown-error'
      if (typeof error === 'string') return error
      return error.diagnostic ?? error.code ?? error.message ?? String(error)
    }

    /** The composition id without the `include:` prefix the Loader adds. */
    function shortId(entryId) {
      const text = typeof entryId === 'string' ? entryId : ''
      return text.startsWith('include:') ? text.slice('include:'.length) : text
    }

    /** The server's display name: its configured serverName, else the entry id. */
    function displayName(row, server) {
      if (server !== undefined && typeof server.serverName === 'string' && server.serverName !== '') return server.serverName
      const entryId = shortId(row.entryId)
      return entryId.startsWith('mcp-') ? entryId.slice(4) : entryId
    }

    /** One line under the name: transport, endpoint, and the entry id when it differs. */
    function subtitle(row, server, name) {
      const parts = []
      if (server !== undefined && typeof server.transport === 'string') parts.push(server.transport)
      if (server !== undefined) {
        if (typeof server.url === 'string' && server.url !== '') parts.push(server.url)
        else if (typeof server.command === 'string' && server.command !== '') parts.push(server.command)
      }
      const id = shortId(row.entryId)
      if (id !== '' && id !== name) parts.push(id)
      return parts.join(' · ')
    }

    /** Why the switch is locked, or undefined when it is not. */
    function lockedReason(row, t) {
      const reason = row.readOnlyReason
      if (reason === undefined) return undefined
      if (reason === 'unaddressable') return t('locked.unaddressable')
      if (reason === 'management-required') return t('locked.management')
      return String(reason)
    }

    /** The state line: off, or the fiber phase in the reader's language. */
    function stateText(row, t) {
      if (!row.enabled) return t('state.off')
      const phase = row.fiberPhase
      if (phase === null || phase === undefined) return t('phase.none')
      return t(`phase.${phase}`)
    }

    /**
     * Read the MCP rows and their configuration, and keep them current.
     * @param ctx - the page plugin's browser context.
     * @param t - dictionary binding.
     * @returns rows, status, notices, and the actions the page binds.
     */
    function useMcpServers(ctx, t) {
      const [state, setState] = useState({ status: 'loading', rows: [], error: null })
      const [servers, setServers] = useState([])
      const [busyId, setBusyId] = useState(null)
      const [notice, setNotice] = useState(null)
      const alive = useRef(true)

      useEffect(() => {
        alive.current = true
        return () => {
          alive.current = false
        }
      }, [])

      const readServers = useCallback(async () => {
        try {
          const response = await fetch('/mcp-panel/servers', { headers: { accept: 'application/json' } })
          if (!response.ok) return
          const body = await response.json()
          if (!alive.current) return
          const list = Array.isArray(body?.servers) ? body.servers : []
          setServers(list)
          diagnose({ route: 'servers', count: list.length })
        } catch (error) {
          /* The panel still lists and switches rows without the Host detail. */
          diagnose({ route: 'servers-failed', error: describeFailure(error) })
        }
      }, [])

      const readRows = useCallback(async () => {
        try {
          const result = await ctx.remote.pluginManager.listPlugins()
          if (!alive.current) return
          if (result === undefined || !result.ok) {
            setState({ status: 'error', rows: [], error: result?.error ?? null })
            return
          }
          const rows = (result.value ?? []).filter((row) => row.moduleName === MCP_MODULE)
          setState({ status: 'ready', rows, error: null })
        } catch (error) {
          if (!alive.current) return
          setState({ status: 'error', rows: [], error: { code: 'remote-unavailable', diagnostic: describeFailure(error) } })
        }
      }, [ctx])

      const refresh = useCallback(async () => {
        await Promise.all([readServers(), readRows()])
      }, [readServers, readRows])

      useEffect(() => {
        void refresh()
        let dispose = () => {}
        try {
          dispose = ctx.remote.$on('plugin-manager/changed', () => {
            void refresh()
          })
        } catch (error) {
          /* Without the event the page still refreshes on demand. */
        }
        return () => {
          if (typeof dispose === 'function') dispose()
        }
      }, [refresh])

      useEffect(() => {
        if (notice === null) return undefined
        const timer = setTimeout(() => setNotice(null), NOTICE_MS)
        return () => clearTimeout(timer)
      }, [notice])

      const setEnabled = useCallback(
        async (row, enabled, label) => {
          const name = label ?? shortId(row.entryId) ?? displayName(row, undefined)
          setBusyId(row.entryId)
          setNotice({ kind: 'info', text: t('notice.busy', { name }) })
          try {
            const result = await ctx.remote.pluginManager.setPluginEnabled(row.entryId, enabled)
            if (result === undefined || !result.ok) {
              setNotice({ kind: 'error', text: t('notice.failed', { message: describeFailure(result?.error) }) })
            } else {
              const application = result.value?.application
              const applied = t(enabled ? 'notice.enabled' : 'notice.disabled', { name })
              if (application === 'failed') {
                setNotice({ kind: 'error', text: t('notice.failed', { message: describeFailure(result.value?.error) }) })
              } else if (application === 'restart-required') {
                setNotice({ kind: 'info', text: t('notice.restart', { name }) })
              } else if (application === 'overridden') {
                setNotice({ kind: 'info', text: t('notice.overridden', { name }) })
              } else if (application === 'cancelled') {
                setNotice({ kind: 'info', text: applied })
              } else {
                setNotice({ kind: 'ok', text: applied })
              }
            }
          } catch (error) {
            setNotice({ kind: 'error', text: t('notice.failed', { message: describeFailure(error) }) })
          }
          await readRows()
          if (alive.current) setBusyId(null)
        },
        [ctx, readRows, t],
      )

      return { ...state, servers, busyId, notice, refresh, setEnabled }
    }

    /** One MCP server: glyph, name, transport line, state, switch. */
    function ServerRow({ row, server, t, busy, onSetEnabled }) {
      const name = displayName(row, server)
      const locked = lockedReason(row, t)
      const disabled = busy || locked !== undefined
      return h(
        'li',
        {
          className: 'mp-row',
          'data-state': row.enabled ? 'on' : 'off',
          'data-mcp-row': row.entryId ?? '',
        },
        h('span', { className: 'mp-glyph', 'aria-hidden': 'true' }, h(RowIcon, null)),
        h(
          'div',
          { className: 'mp-main' },
          h('span', { className: 'mp-name', title: row.entryId }, name),
          h('span', { className: 'mp-sub', title: subtitle(row, server, name) }, subtitle(row, server, name)),
        ),
        h(
          'div',
          { className: 'mp-side' },
          h(
            'span',
            { className: 'mp-state', 'data-phase': row.enabled ? String(row.fiberPhase ?? 'pending') : 'off' },
            h('span', { className: 'mp-dot', 'aria-hidden': 'true' }),
            stateText(row, t),
          ),
          h('button', {
            type: 'button',
            role: 'switch',
            className: 'mp-switch',
            'data-on': row.enabled ? 'true' : 'false',
            'aria-checked': row.enabled ? 'true' : 'false',
            'aria-label': t('toggle.label', { name }),
            title: locked ?? t('toggle.label', { name }),
            disabled,
            onClick: () => {
              onSetEnabled(row, !row.enabled, name)
            },
          }, h('span', { className: 'mp-knob', 'aria-hidden': 'true' })),
        ),
      )
    }

    /** The whole panel. */
    function McpPage(props) {
      const { ctx, t } = props
      const list = useMcpServers(ctx, t)
      const byId = useMemo(() => {
        const map = new Map()
        for (const server of list.servers) {
          if (server !== undefined && server.entryId !== undefined) map.set(server.entryId, server)
        }
        return map
      }, [list.servers])
      const rows = useMemo(() => {
        return [...list.rows].sort((a, b) => {
          const left = displayName(a, byId.get(a.entryId))
          const right = displayName(b, byId.get(b.entryId))
          return left.localeCompare(right)
        })
      }, [list.rows, byId])
      const enabled = rows.filter((row) => row.enabled).length
      const refresh = list.refresh

      return h(
        'section',
        { className: 'mp-page', 'data-mcp-panel': true, 'aria-busy': list.status === 'loading' },
        h(
          'header',
          { className: 'mp-head' },
          h(
            'div',
            { className: 'mp-heading' },
            h('h1', { className: 'mp-title' }, t('title')),
            h('p', { className: 'mp-intro' }, t('intro')),
          ),
          h(
            'div',
            { className: 'mp-toolbar' },
            rows.length === 0 ? null : h('span', { className: 'mp-count' }, t('count', { total: rows.length, on: enabled })),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-refresh',
                disabled: list.status === 'loading',
                onClick: () => {
                  void refresh()
                },
              },
              t('refresh'),
            ),
          ),
        ),
        list.notice === null
          ? null
          : h('p', { className: 'mp-notice', 'data-kind': list.notice.kind, role: 'status' }, list.notice.text),
        list.status === 'loading' && rows.length === 0 ? h('p', { className: 'mp-status' }, t('loading')) : null,
        list.status === 'error'
          ? h(
              'div',
              { className: 'mp-empty', role: 'alert' },
              h('p', { className: 'mp-status' }, t('error', { message: describeFailure(list.error) })),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mp-refresh',
                  onClick: () => {
                    void refresh()
                  },
                },
                t('retry'),
              ),
            )
          : null,
        list.status === 'ready' && rows.length === 0
          ? h(
              'div',
              { className: 'mp-empty' },
              h('h2', null, t('empty.title')),
              h('p', null, t('empty.hint')),
            )
          : null,
        rows.length === 0
          ? null
          : h(
              'ul',
              { className: 'mp-list' },
              rows.map((row) =>
                h(ServerRow, {
                  key: row.entryId,
                  row,
                  server: byId.get(row.entryId),
                  t,
                  busy: list.busyId === row.entryId,
                  onSetEnabled: list.setEnabled,
                }),
              ),
            ),
        h(
          'p',
          { className: 'mp-hint' },
          t('hint')
            .split('mcp__<serverName>__<tool>')
            .flatMap((part, index) => {
              const nodes = []
              if (index > 0) nodes.push(h('code', { key: `code-${String(index)}` }, 'mcp__<serverName>__<tool>'))
              if (part !== '') nodes.push(h('span', { key: `text-${String(index)}` }, part))
              return nodes
            }),
        ),
      )
    }

    /** Keep a rendering failure inside the panel and report it instead of blanking the page. */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error) {
        diagnose({ render: 'failed', error: describeFailure(error) })
      }

      render() {
        if (this.state.error !== null) {
          return h('p', { className: 'mp-status', role: 'alert' }, this.props.t('render.failed', { message: describeFailure(this.state.error) }))
        }
        return this.props.children
      }
    }

    return {
      /** Services required by the sidebar registration and the Remote calls. */
      inject: ['slots', 'locale', 'remote', 'remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mcp-panel: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.effect(() => {
          if (typeof document === 'undefined') return undefined
          const existing = document.querySelector('style[data-mcp-panel-style]')
          if (existing) existing.remove()
          const tag = document.createElement('style')
          tag.dataset.mcpPanelStyle = 'true'
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'mcp-panel: styles')

        /* The page itself; the sidebar's panellist entry addresses this key. */
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: PANEL_ID, locale: NS },
            () => h(PanelBoundary, { t }, h(McpPage, { ctx, t })),
          ),
        )

        /* The sidebar entry, between Plugins (0) and Schedules (10). */
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: PANEL_ORDER,
              label: () => t('panel'),
              locale: NS,
            },
            PanelIcon,
          ),
        )

        /*
         * Diagnostics: one line per Client load, plus the page's own read, so a
         * silently failed bundle or a broken data path is visible in
         * %DSH_HOME%\mcp-panel.log without opening the GUI.
         */
        diagnose({ panel: PANEL_ID, at: Date.now() })
        try {
          void ctx.remote.pluginManager
            .listPlugins()
            .then((result) => {
              if (result === undefined || !result.ok) {
                diagnose({ probe: 'failed', error: describeFailure(result?.error) })
                return
              }
              const rows = (result.value ?? []).filter((row) => row.moduleName === MCP_MODULE)
              diagnose({
                probe: 'ok',
                servers: rows.map((row) => ({
                  entryId: row.entryId,
                  enabled: row.enabled,
                  readOnlyReason: row.readOnlyReason ?? null,
                  fiberPhase: row.fiberPhase ?? null,
                })),
              })
            })
            .catch((error) => diagnose({ probe: 'threw', error: describeFailure(error) }))
        } catch (error) {
          diagnose({ probe: 'unavailable', error: describeFailure(error) })
        }
      },
    }
  },
})
