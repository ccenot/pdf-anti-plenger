const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, exec } = require('child_process');
const { processPdfSplit } = require('./core_splitter');

const PORT = 4321;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DIALOG_HELPER = path.join(__dirname, 'dialog_helper.ps1');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const userProfile = (process.env.USERPROFILE || process.env.HOME || 'C:/Users/Default').replace(/\\/g, '/');

function loadConfig() {
    let cfg = null;
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error("Gagal membaca config:", e);
    }
    if (!cfg) {
        cfg = {};
    }

    const defaultDocPath = path.join(userProfile, 'Documents', 'anti plenger').replace(/\\/g, '/');
    const defaultAppPath = path.join(__dirname, 'anti plenger').replace(/\\/g, '/');

    // Selalu pastikan output default mengarah ke folder Documents/anti plenger
    cfg.defaultOutputDir = defaultDocPath;

    cfg.appName = cfg.appName || "PDF ANTI PLENGER";
    cfg.systemPresets = {
        documents: defaultDocPath,
        appFolder: defaultAppPath
    };

    return cfg;
}

function saveConfig(data) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Windows native dialog via standalone ps1 helper
function runDialog(type, initialDir) {
    return new Promise((resolve) => {
        const args = [
            '-Sta',
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', DIALOG_HELPER,
            '-Type', type,
            '-InitialDir', initialDir || ''
        ];
        execFile('powershell.exe', args, { encoding: 'utf8', timeout: 120000 }, (err, stdout, stderr) => {
            if (err) {
                console.error(`PS Dialog (${type}) error:`, err, stderr);
                return resolve(null);
            }
            const cleanPath = stdout.trim().split(/\r?\n/).pop() || '';
            resolve(cleanPath.trim() || null);
        });
    });
}

function openFolderInExplorer(folderPath) {
    if (!folderPath) return;
    const clean = folderPath.trim().replace(/^["']|["']$/g, '');
    const safePath = path.resolve(clean);
    if (!fs.existsSync(safePath)) {
        fs.mkdirSync(safePath, { recursive: true });
    }
    const winPath = safePath.replace(/\//g, '\\').replace(/\\+$/, '');
    console.log(`[EXPLORER] Membuka folder: ${winPath}`);
    
    const psCmd = `powershell.exe -NoProfile -Command "Start-Process explorer.exe -ArgumentList '${winPath.replace(/'/g, "''")}'"`;
    exec(psCmd, (err) => {
        if (err) {
            console.error("[EXPLORER] PS gagal, coba fallback cmd start:", err);
            exec(`start "" "${winPath}"`, { shell: 'cmd.exe' });
        }
    });
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 50 * 1024 * 1024) reject(new Error("Payload too large"));
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

// MIME types dictionary
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. API: Get Config
    if (pathname === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(loadConfig()));
        return;
    }

    // 2. API: Save Config
    if (pathname === '/api/config' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const current = loadConfig();
            const updated = { ...current, ...body };
            saveConfig(updated);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, config: updated }));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // 3. API: Scan Recent PDF files from Downloads & Documents
    if (pathname === '/api/recent-pdfs' && req.method === 'GET') {
        const candidateDirs = [
            path.join(process.env.USERPROFILE || 'C:/Users/notnot', 'Downloads'),
            path.join(process.env.USERPROFILE || 'C:/Users/notnot', 'Documents')
        ];
        const results = [];
        for (const dir of candidateDirs) {
            try {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    for (const f of files) {
                        if (f.toLowerCase().endsWith('.pdf')) {
                            const full = path.join(dir, f);
                            try {
                                const st = fs.statSync(full);
                                if (st.isFile()) {
                                    results.push({
                                        name: f,
                                        fullPath: full.replace(/\\/g, '/'),
                                        sizeBytes: st.size,
                                        mtime: st.mtimeMs
                                    });
                                }
                            } catch (_) {}
                        }
                    }
                }
            } catch (_) {}
        }
        // Sort by newest modified
        results.sort((a, b) => b.mtime - a.mtime);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results.slice(0, 8)));
        return;
    }

    // 4. API: Upload File from Browser (Drag & Drop / HTML5 file input)
    if (pathname === '/api/upload' && req.method === 'POST') {
        const rawFileName = req.headers['x-file-name'] || `upload_${Date.now()}.pdf`;
        const cleanName = decodeURIComponent(rawFileName).replace(/[^a-zA-Z0-9._ -]/g, '_');
        const targetPath = path.join(UPLOADS_DIR, cleanName);

        const writeStream = fs.createWriteStream(targetPath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            const stat = fs.statSync(targetPath);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                filePath: targetPath.replace(/\\/g, '/'),
                name: cleanName,
                sizeBytes: stat.size
            }));
        });

        writeStream.on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
        return;
    }

    // 5. API: Browse File Dialog (Native Windows)
    if (pathname === '/api/browse-file' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        const filePath = await runDialog('file', body.initialDir);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ filePath }));
        return;
    }

    // 6. API: Browse Folder Dialog (Native Windows)
    if (pathname === '/api/browse-folder' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        const folderPath = await runDialog('folder', body.initialDir);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ folderPath }));
        return;
    }

    // 7. API: Open Folder in Explorer
    if (pathname === '/api/open-folder' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        openFolderInExplorer(body.folderPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 8. API: Check/Inspect Path
    if (pathname === '/api/inspect-path' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        const target = body.path;
        if (target && fs.existsSync(target)) {
            const stat = fs.statSync(target);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                exists: true,
                isFile: stat.isFile(),
                sizeBytes: stat.size,
                name: path.basename(target),
                cleanPath: target.replace(/\\/g, '/')
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ exists: false }));
        }
        return;
    }

    // 9. API: SSE Stream PDF Split Execution
    if (pathname === '/api/split-stream' && req.method === 'GET') {
        const sourcePdf = parsedUrl.searchParams.get('source');
        let outputDir = parsedUrl.searchParams.get('output');

        const config = loadConfig();
        if (!outputDir || outputDir === 'auto' || outputDir === 'undefined') {
            outputDir = config.defaultOutputDir;
        }

        if (!sourcePdf) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end("Parameter source dibutuhkan!");
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
        });

        const sendEvent = (event, data) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const outputDirs = [outputDir];

        try {
            sendEvent('log', { text: `[START] Memulai pemecahan file: ${sourcePdf}`, level: 'info' });
            
            const summary = await processPdfSplit({
                sourcePdfPath: sourcePdf,
                outputDirs,
                knownCities: config.knownCities,
                specialAliases: config.specialAliases || {},
                onLog: (text, level) => {
                    sendEvent('log', { text, level });
                },
                onProgress: (current, total, item) => {
                    sendEvent('progress', { current, total, item });
                }
            });

            sendEvent('done', { summary, total: summary.length });
        } catch (err) {
            console.error("Split error:", err);
            sendEvent('error', { message: err.message });
        } finally {
            res.end();
        }
        return;
    }

    // 10. Static File Serving (from public/)
    let reqPath = pathname === '/' ? '/index.html' : pathname;
    const safeFilePath = path.join(PUBLIC_DIR, path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, ''));

    if (fs.existsSync(safeFilePath) && fs.statSync(safeFilePath).isFile()) {
        const ext = path.extname(safeFilePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(safeFilePath).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("404 Not Found");
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`=======================================================`);
    console.log(`   PDF ANTI PLENGER`);
    console.log(`   Server aktif di http://localhost:${PORT}`);
    console.log(`=======================================================`);
});
