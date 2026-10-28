/**
 * mcp-panel — host half.
 *
 * The panel itself is the browser half (`client.js`). The Host owns the two
 * things the renderer cannot read on its own:
 *
 *  - each MCP entry's non-secret configuration (transport, endpoint, server
 *    name), which only exists on the Loader entry, not in the read-only plugin
 *    inventory the browser sees;
 *  - a diagnostic route, so a silently loaded or failed Client plugin is
 *    visible from a log file instead of guesswork.
 *
 * The switch itself is not implemented here: `client.js` calls the existing
 * `pluginManager.setPluginEnabled` Remote, which writes the profile patch and
 * lets HMR recompose. This half never writes profile state.
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Module identifier every MCP server row is configured with. */
const MCP_MODULE = '@deepseek-ai/dsh-mcp-client'
/** Route prefix owned by this plugin. */
const ROUTE = '/mcp-panel'
/** Diagnostic log location; the panel writes nothing outside this file. */
const LOG_DIR = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? '.', '.dsh')
const LOG_FILE = join(LOG_DIR, 'mcp-panel.log')

/** Fiber state numbers, mirrored from the inventory projection: 4 has no phase. */
const FIBER_PHASE = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: null,
  5: 'unloading',
}

/** Services that must exist before this plugin activates. */
export const inject = []

/** Append one diagnostic line; logging must never break the panel. */
async function record(line) {
  try {
    await mkdir(LOG_DIR, { recursive: true })
    await appendFile(LOG_FILE, `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch (error) {
    console.warn('mcp-panel: cannot write the diagnostic log', error)
  }
}

/** Best-effort message for a thrown value. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Project the profile's MCP entries for the panel.
 *
 * Only display fields are copied: request headers and stdio environments can
 * carry credentials and never leave the Host.
 * @param ctx - Host context with the Loader service.
 * @returns one row per configured MCP server, in Loader order.
 */
function readServers(ctx) {
  const rows = []
  for (const entry of ctx.loader.entries()) {
    const options = entry.options ?? {}
    if (options.group === true) continue
    if (options.name !== MCP_MODULE) continue
    const config = options.config ?? {}
    const row = {
      entryId: entry.id,
      enabled: !entry.disabled,
      phase: entry.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
    }
    if (typeof config.serverName === 'string') row.serverName = config.serverName
    if (typeof config.transport === 'string') row.transport = config.transport
    if (typeof config.url === 'string') row.url = config.url
    if (typeof config.command === 'string') row.command = config.command
    rows.push(row)
  }
  return rows
}

/** Write one JSON answer. */
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Collect a small request body, ignoring anything larger. */
function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 4096) body = body.slice(0, 4096)
    })
    req.on('end', () => resolve(body))
    req.on('error', () => resolve(body))
  })
}

/**
 * Log the addressability of every MCP row once the manager is mounted.
 *
 * `pluginManager.setPluginEnabled` refuses rows the profile patch cannot
 * address; recording that here makes a silent, permanently disabled switch
 * diagnosable without opening the GUI.
 */
function reportAddressability(ctx) {
  ctx.inject(['pluginManager'], (managerCtx) => {
    managerCtx.effect(
      () => {
        let live = true
        managerCtx.pluginManager
          .listPlugins()
          .then((rows) => {
            if (!live) return
            const mcp = rows
              .filter((row) => row.moduleName === MCP_MODULE)
              .map((row) => ({
                entryId: row.entryId,
                enabled: row.enabled,
                patchId: row.patchId ?? null,
                readOnlyReason: row.readOnlyReason ?? null,
                fiberPhase: row.fiberPhase ?? null,
              }))
            record(`addressability ${JSON.stringify(mcp)}`)
          })
          .catch((error) => record(`addressability-failed ${messageOf(error)}`))
        return () => {
          live = false
        }
      },
      'mcp-panel: addressability diagnostic',
    )
  })
}

/** Host plugin body. */
export function apply(ctx) {
  let rows = []
  try {
    rows = readServers(ctx)
  } catch (error) {
    record(`read-servers-failed ${messageOf(error)}`)
  }
  record(`host-applied servers=${JSON.stringify(rows.map((row) => row.entryId))}`)
  reportAddressability(ctx)

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'prefix',
          path: ROUTE,
          handler: (req, res) => {
            const url = req.url ?? ''
            if (url.startsWith(`${ROUTE}/servers`)) {
              let servers
              try {
                servers = readServers(ctx)
              } catch (error) {
                json(res, 500, { error: messageOf(error) })
                return
              }
              json(res, 200, { servers })
              return
            }
            if (url.startsWith(`${ROUTE}/loaded`)) {
              void readBody(req).then((body) => record(`client-loaded ${body}`))
              json(res, 200, { ok: true })
              return
            }
            json(res, 404, { error: 'not-found' })
          },
        }),
      'mcp-panel: servers and diagnostic routes',
    )
  })
}
