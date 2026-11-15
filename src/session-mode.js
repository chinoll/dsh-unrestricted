/** Resolve an explicit session choice, inheriting only for delegated subagents. */
export function sessionEnabled(config, sessionId, lookupHeader) {
  const visited = new Set()
  let id = sessionId
  while (id && !visited.has(id)) {
    visited.add(id)
    if (Object.hasOwn(config.sessions ?? {}, id)) return config.sessions[id]
    const header = lookupHeader?.(id)
    if (header?.origin !== 'subagent') break
    id = header.parentSession
  }
  return config.enabled ?? true
}
