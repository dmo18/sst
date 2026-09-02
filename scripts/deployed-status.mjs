function deploymentMetadata(text) {
  return Object.fromEntries(String(text).trim().split(/\r?\n/).map(line => {
    const separator = line.indexOf(':');
    return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : [line.trim(), ''];
  }));
}

export function statusPathFromDeployment(text) {
  const metadata = deploymentMetadata(text);
  const candidate = metadata.status_path || 'status.json';
  if (!/^(?:status\.json|status-[A-Za-z0-9_-]+\.json)$/.test(candidate))
    throw new Error(`deployment status_path is unsafe: ${candidate}`);
  return { metadata, statusPath: candidate };
}

export async function resolveDeployedStatus(baseUrl, { fetchImpl = fetch, token = Date.now() } = {}) {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const versionUrl = new URL('deploy-version.txt', base);
  versionUrl.searchParams.set('freshness', String(token));
  const response = await fetchImpl(versionUrl, { redirect: 'follow', cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`deploy-version.txt failed with HTTP ${response.status}`);
  const { metadata, statusPath } = statusPathFromDeployment(text);
  const statusUrl = new URL(statusPath, base);
  statusUrl.searchParams.set('freshness', String(token));
  return { metadata, statusPath, statusUrl: statusUrl.href };
}
