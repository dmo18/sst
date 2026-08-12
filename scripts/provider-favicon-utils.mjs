function attributesFromTag(tag) {
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function sizeScore(raw) {
  if (!raw || raw.toLowerCase() === 'any') return 48;
  const values = raw
    .split(/\s+/)
    .map(value => value.match(/^(\d+)x(\d+)$/i))
    .filter(Boolean)
    .map(match => Math.min(Number(match[1]), Number(match[2])))
    .filter(Number.isFinite);
  if (!values.length) return 32;
  const size = Math.max(...values);
  if (size >= 32 && size <= 128) return 100 + size;
  if (size > 128) return 92;
  return 60 + size;
}

export function providerPageUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.href;
}

export function faviconCandidates(html, pageUrl) {
  const candidates = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = attributesFromTag(match[0]);
    const rel = (attributes.rel || '').toLowerCase();
    const href = attributes.href;
    if (!href || !rel.includes('icon')) continue;
    let url;
    try {
      url = new URL(href, pageUrl).href;
    }
    catch {
      continue;
    }
    const apple = rel.includes('apple-touch-icon');
    candidates.push({
      url,
      score: sizeScore(attributes.sizes) + (apple ? 18 : 0)
    });
  }

  const origin = new URL(pageUrl).origin;
  candidates.push({ url: `${origin}/favicon.png`, score: 70 });
  candidates.push({ url: `${origin}/favicon.ico`, score: 65 });
  candidates.push({ url: `${origin}/apple-touch-icon.png`, score: 60 });

  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (!unique.has(candidate.url)) unique.set(candidate.url, candidate);
  }
  return [...unique.values()];
}

function startsWith(buffer, values) {
  if (buffer.length < values.length) return false;
  return values.every((value, index) => buffer[index] === value);
}

function pngFromIco(buffer) {
  if (buffer.length < 22 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;
  const count = buffer.readUInt16LE(4);
  const images = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > buffer.length) break;
    const width = buffer[offset] || 256;
    const height = buffer[offset + 1] || 256;
    const bytes = buffer.readUInt32LE(offset + 8);
    const start = buffer.readUInt32LE(offset + 12);
    const end = start + bytes;
    if (bytes <= 0 || end > buffer.length) continue;
    const image = buffer.subarray(start, end);
    if (!startsWith(image, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) continue;
    images.push({ image, area: width * height });
  }
  images.sort((a, b) => b.area - a.area);
  return images[0]?.image ?? null;
}

export function normalizeFavicon(buffer, contentType = '') {
  const type = contentType.toLowerCase().split(';')[0].trim();
  const textStart = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart();

  if (type === 'image/svg+xml' || textStart.startsWith('<svg') || textStart.startsWith('<?xml')) {
    return { bytes: buffer, mime: 'image/svg+xml' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { bytes: buffer, mime: 'image/png' };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { bytes: buffer, mime: 'image/jpeg' };
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return { bytes: buffer, mime: 'image/gif' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { bytes: buffer, mime: 'image/webp' };
  }
  if (type === 'image/x-icon' || type === 'image/vnd.microsoft.icon' || startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) {
    const png = pngFromIco(buffer);
    if (png) return { bytes: png, mime: 'image/png' };
    if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) return { bytes: buffer, mime: 'image/x-icon' };
  }
  return null;
}

export function faviconWrapperDataUri(bytes, mime, options = {}) {
  const background = options.background || '#f8fafc';
  const nested = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><rect width="64" height="64" rx="14" fill="${background}"/><rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="#cbd5e1" stroke-width="2"/><image x="7" y="7" width="50" height="50" preserveAspectRatio="xMidYMid meet" href="${nested}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
