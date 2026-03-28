export function withProjectQuery(url: string, projectId: string) {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}project=${encodeURIComponent(projectId)}`
}
