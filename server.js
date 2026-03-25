import express from 'express';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';

const app = express();

app.disable('x-powered-by');
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? '8000', 10);
/** Bind address: 0.0.0.0 = reachable on your LAN (phones/tablets on same Wi‑Fi). Use HOST=127.0.0.1 to block that. */
const HOST = (process.env.HOST ?? '0.0.0.0').trim() || '0.0.0.0';

function lanIPv4Addresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

function isPrivateHostname(hostname) {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '127.0.0.1' ||
    h === '::1' ||
    /^10\.\d+\.\d+\.\d+$/.test(h) ||
    /^192\.168\.\d+\.\d+$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)
  );
}

function getAllowedHosts() {
  const raw = (process.env.ALLOW_HOSTS ?? '').trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

const allowedHosts = getAllowedHosts();

function assertUpstreamAllowed(upstreamUrl) {
  let u;
  try {
    u = new URL(upstreamUrl);
  } catch {
    const err = new Error('Invalid upstream URL');
    err.statusCode = 400;
    throw err;
  }

  if (!['http:', 'https:'].includes(u.protocol)) {
    const err = new Error('Only http/https upstream URLs are allowed');
    err.statusCode = 400;
    throw err;
  }

  if (isPrivateHostname(u.hostname)) {
    const err = new Error('Private/localhost upstream is not allowed');
    err.statusCode = 400;
    throw err;
  }

  if (allowedHosts && !allowedHosts.has(u.hostname.toLowerCase())) {
    const err = new Error('Upstream host not in allowlist');
    err.statusCode = 403;
    throw err;
  }

  return u;
}

function pickForwardHeaders(req) {
  // Some upstreams require a browser-like UA/Referer to serve the feed.
  const headers = {};
  const ua = req.header('x-upstream-user-agent');
  const ref = req.header('x-upstream-referer');
  if (ua) headers['user-agent'] = ua;
  if (ref) headers['referer'] = ref;
  return headers;
}

const EARTHCAM_REFERER = 'https://www.earthcam.com/';
const EARTHCAM_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** EarthCam CDNs return 403 without a site Referer + browser UA. */
function upstreamFetchHeaders(upstreamUrl, req) {
  const base = pickForwardHeaders(req);
  try {
    const h = new URL(upstreamUrl).hostname.toLowerCase();
    if (h.endsWith('earthcam.com')) {
      return {
        ...base,
        referer: base.referer || EARTHCAM_REFERER,
        'user-agent': base['user-agent'] || EARTHCAM_UA
      };
    }
  } catch (_) {}
  return base;
}

function extractEarthCamStream(html, camName) {
  const esc = camName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `"cam_name":"${esc}"[\\s\\S]{0,12000}?"stream":"((?:\\\\.|[^"\\\\])*)"`,
    'm'
  );
  const m = html.match(re);
  if (!m) return null;
  try {
    const url = JSON.parse(`"${m[1]}"`);
    return url && url.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

function assertEarthcamPageUrl(pageUrl) {
  let u;
  try {
    u = new URL(pageUrl);
  } catch {
    const err = new Error('Invalid EarthCam page URL');
    err.statusCode = 400;
    throw err;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'www.earthcam.com') {
    const err = new Error('Only https://www.earthcam.com/ embed pages are allowed');
    err.statusCode = 400;
    throw err;
  }
  return u;
}

/** Many tiles used to fetch the same cam HTML at once; dedupe + short cache (tokens expire). */
const earthcamInflight = new Map();
const earthcamResolved = new Map();
const EARTHCAM_CACHE_MS = 25_000;

async function resolveEarthCamStreamUrl(page, cam) {
  const key = `${page}\n${cam}`;
  const hit = earthcamResolved.get(key);
  if (hit && hit.expires > Date.now()) return hit.streamUrl;

  let wait = earthcamInflight.get(key);
  if (!wait) {
    wait = (async () => {
      const pageRes = await fetch(page, {
        redirect: 'follow',
        headers: { referer: EARTHCAM_REFERER, 'user-agent': EARTHCAM_UA }
      });
      const html = await pageRes.text();
      const streamUrl = extractEarthCamStream(html, cam);
      if (streamUrl) {
        earthcamResolved.set(key, {
          streamUrl,
          expires: Date.now() + EARTHCAM_CACHE_MS
        });
      }
      return streamUrl;
    })().finally(() => {
      earthcamInflight.delete(key);
    });
    earthcamInflight.set(key, wait);
  }
  return wait;
}

function setProxyResponseHeaders(res) {
  // Keep things simple for local dev usage
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Cache-Control', 'no-store');
}

app.get('/api/config', async (_req, res) => {
  // Serve config.json via the server so you can later extend it
  res.sendFile(path.join(__dirname, 'config.json'));
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, proxy: true });
});

app.get('/proxy/image', async (req, res) => {
  try {
    const upstreamUrl = req.query.url;
    if (typeof upstreamUrl !== 'string' || !upstreamUrl) {
      return res.status(400).send('Missing url');
    }

    const u = assertUpstreamAllowed(upstreamUrl);
    const upstreamRes = await fetch(u, {
      redirect: 'follow',
      headers: upstreamFetchHeaders(upstreamUrl, req)
    });

    setProxyResponseHeaders(res);
    res.status(upstreamRes.status);

    const ct = upstreamRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    if (!upstreamRes.body) return res.end();
    Readable.fromWeb(upstreamRes.body).pipe(res);
  } catch (e) {
    const status = e?.statusCode ?? 502;
    res.status(status).send(String(e?.message ?? e));
  }
});

app.get('/proxy/earthcam/hls.m3u8', async (req, res) => {
  try {
    const page = req.query.page;
    const cam = req.query.cam;
    if (typeof page !== 'string' || typeof cam !== 'string' || !page || !cam) {
      return res.status(400).send('Missing page or cam');
    }
    assertEarthcamPageUrl(page);

    const streamUrl = await resolveEarthCamStreamUrl(page, cam);
    if (!streamUrl) {
      return res.status(502).send('Could not resolve EarthCam stream (wrong cam or page?)');
    }

    const u = assertUpstreamAllowed(streamUrl);
    const upstreamRes = await fetch(u, {
      redirect: 'follow',
      headers: {
        ...upstreamFetchHeaders(streamUrl, req),
        accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*'
      }
    });

    const text = await upstreamRes.text();

    setProxyResponseHeaders(res);
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritePlaylistText(text, u.toString()));
  } catch (e) {
    const status = e?.statusCode ?? 502;
    res.status(status).send(String(e?.message ?? e));
  }
});

app.get('/proxy/mjpeg', async (req, res) => {
  try {
    const upstreamUrl = req.query.url;
    if (typeof upstreamUrl !== 'string' || !upstreamUrl) {
      return res.status(400).send('Missing url');
    }

    const u = assertUpstreamAllowed(upstreamUrl);
    const upstreamRes = await fetch(u, {
      redirect: 'follow',
      headers: upstreamFetchHeaders(upstreamUrl, req)
    });

    setProxyResponseHeaders(res);
    res.status(upstreamRes.status);

    const ct = upstreamRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('X-Accel-Buffering', 'no');

    if (!upstreamRes.body) return res.end();
    Readable.fromWeb(upstreamRes.body).pipe(res);
  } catch (e) {
    const status = e?.statusCode ?? 502;
    res.status(status).send(String(e?.message ?? e));
  }
});

function rewritePlaylistText(playlistText, playlistUrl) {
  const base = new URL(playlistUrl);

  const rewriteUri = (raw) => {
    const resolved = new URL(raw, base).toString();
    if (resolved.endsWith('.m3u8')) {
      return `/proxy/hls/playlist.m3u8?url=${encodeURIComponent(resolved)}`;
    }
    return `/proxy/hls/asset?u=${encodeURIComponent(resolved)}`;
  };

  return playlistText
    .split('\n')
    .map((line) => {
      // Rewrite key URIs: #EXT-X-KEY:...URI="..."
      if (line.startsWith('#EXT-X-KEY')) {
        return line.replace(/URI=\"([^\"]+)\"/g, (_m, uri) => `URI="${rewriteUri(uri)}"`);
      }

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      return rewriteUri(trimmed);
    })
    .join('\n');
}

app.get('/proxy/hls/playlist.m3u8', async (req, res) => {
  try {
    const upstreamUrl = req.query.url;
    if (typeof upstreamUrl !== 'string' || !upstreamUrl) {
      return res.status(400).send('Missing url');
    }

    const u = assertUpstreamAllowed(upstreamUrl);
    const upstreamRes = await fetch(u, {
      redirect: 'follow',
      headers: {
        ...upstreamFetchHeaders(upstreamUrl, req),
        // Some CDNs gate HLS by Accept
        accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*'
      }
    });

    const text = await upstreamRes.text();

    setProxyResponseHeaders(res);
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

    // Even for non-200, return what we got for debugging
    res.send(rewritePlaylistText(text, u.toString()));
  } catch (e) {
    const status = e?.statusCode ?? 502;
    res.status(status).send(String(e?.message ?? e));
  }
});

app.get('/proxy/hls/asset', async (req, res) => {
  try {
    const upstreamUrl = req.query.u;
    if (typeof upstreamUrl !== 'string' || !upstreamUrl) {
      return res.status(400).send('Missing u');
    }

    const u = assertUpstreamAllowed(upstreamUrl);
    const upstreamRes = await fetch(u, {
      redirect: 'follow',
      headers: upstreamFetchHeaders(upstreamUrl, req)
    });

    setProxyResponseHeaders(res);
    res.status(upstreamRes.status);

    const ct = upstreamRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    if (!upstreamRes.body) return res.end();
    Readable.fromWeb(upstreamRes.body).pipe(res);
  } catch (e) {
    const status = e?.statusCode ?? 502;
    res.status(status).send(String(e?.message ?? e));
  }
});

// Serve static files from repo root
app.use(express.static(__dirname, { extensions: ['html'] }));

const server = app.listen(PORT, HOST, () => {
  console.log(`capstone-vision listening on http://localhost:${PORT}`);
  if (HOST === '0.0.0.0' || HOST === '::') {
    const ips = lanIPv4Addresses();
    if (ips.length) {
      console.log('  Same Wi‑Fi / LAN — open on another device:');
      for (const ip of ips) console.log(`    http://${ip}:${PORT}`);
    }
    console.log(
      '  Over the public internet use a tunnel (ngrok, Cloudflare Tunnel, etc.) with HTTPS if you need the webcam on phones.'
    );
  } else {
    console.log(`  (bound to ${HOST} only)`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use (often another terminal running: python3 -m http.server).\n\n` +
        `Fix one of these:\n` +
        `  1) Stop that other server (Ctrl+C), then run: npm run dev\n` +
        `  2) Use a free port:     PORT=3000 npm run dev\n` +
        `     (or: npm run dev:3000)\n` +
        `     Then open http://localhost:3000\n`
    );
    process.exit(1);
  }
  throw err;
});

