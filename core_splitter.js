const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const PDFParser = require('pdf2json');

/**
 * Split and rename PO PDF pages
 * @param {Object} options
 * @param {string} options.sourcePdfPath - Path to source PDF file
 * @param {string[]} options.outputDirs - Array of output directory paths
 * @param {string[]} options.knownCities - List of known cities to detect
 * @param {Object} options.specialAliases - Map of typo/aliases (e.g. { "MAGELAN G": "MAGELANG" })
 * @param {Function} options.onProgress - Callback (current, total, itemData)
 * @param {Function} options.onLog - Callback (logString, level)
 * @returns {Promise<Array>} Summary list of all processed pages
 */
async function processPdfSplit({
    sourcePdfPath,
    outputDirs,
    knownCities = [],
    specialAliases = {},
    onProgress = () => {},
    onLog = () => {}
}) {
    if (!fs.existsSync(sourcePdfPath)) {
        throw new Error(`File PDF sumber tidak ditemukan: ${sourcePdfPath}`);
    }

    outputDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    onLog(`[INIT] Membaca file PDF: ${path.basename(sourcePdfPath)}...`, 'info');

    const sourceBytes = fs.readFileSync(sourcePdfPath);
    const sourceDoc = await PDFDocument.load(sourceBytes);
    const pageCount = sourceDoc.getPageCount();

    onLog(`[INFO] Dokumen berhasil dimuat. Total: ${pageCount} halaman.`, 'info');

    // Parse text structure with pdf2json
    const pdfData = await new Promise((resolve, reject) => {
        const parser = new PDFParser();
        parser.on("pdfParser_dataError", err => reject(new Error(err.parserError || "Gagal parse struktur PDF")));
        parser.on("pdfParser_dataReady", data => resolve(data));
        parser.parseBuffer(sourceBytes);
    });

    const summary = [];

    for (let i = 0; i < pageCount; i++) {
        const pageData = pdfData.Pages[i];
        if (!pageData) {
            onLog(`[WARN] Halaman ${i + 1}: Data teks kosong.`, 'warn');
            continue;
        }

        // Reconstruct text lines sorted by coordinates
        const texts = (pageData.Texts || []).map(t => {
            const str = decodeURIComponent((t.R || []).map(r => r.T).join(""));
            return { x: t.x, y: t.y, text: str };
        });

        texts.sort((a, b) => (Math.abs(a.y - b.y) > 0.3 ? a.y - b.y : a.x - b.x));

        const lines = [];
        let cur = [];
        let ly = -1;
        for (let t of texts) {
            if (ly === -1 || Math.abs(t.y - ly) < 0.3) {
                cur.push(t.text);
            } else {
                lines.push(cur.join(" "));
                cur = [t.text];
            }
            ly = t.y;
        }
        if (cur.length) lines.push(cur.join(" "));
        const fullText = lines.join("\n");

        // 1. Ekstraksi Nomor PO (10 digit standar Growell)
        const poMatch = fullText.match(/No\.?\s*(\d{10})/i);
        const poNumber = poMatch ? poMatch[1] : `PO_${i + 1}`;

        // 2. Isolasi hanya bagian "Delivery address" (menghindari nama vendor/supplier)
        let delLines = [];
        let capturing = false;
        for (const line of lines) {
            if (line.includes("Delivery address")) {
                capturing = true;
                delLines.push(line);
            } else if (capturing) {
                if (line.startsWith("To :") || line.includes("GROWELL") || line.includes("Supplier Code") || line.includes("NPWP :")) {
                    capturing = false;
                } else {
                    delLines.push(line);
                }
            }
        }

        let delBlock = delLines.join(" ").toUpperCase();
        if (!delBlock.trim()) {
            delBlock = fullText.toUpperCase();
        }

        // Apply known special alias replacements first
        for (const [alias, canonical] of Object.entries(specialAliases)) {
            const aliasRegex = new RegExp(alias.replace(/\s+/g, "\\s+"), "gi");
            delBlock = delBlock.replace(aliasRegex, canonical);
        }

        // 3. Deteksi Kota
        let detectedCity = "";

        // a. Cek pola "KAB. / KABUPATEN <NAMA_KOTA>"
        const kabMatch = delBlock.match(/KAB(?:UPATEN)?\.?\s+([A-Z]+)/);
        if (kabMatch && knownCities.includes(kabMatch[1])) {
            detectedCity = kabMatch[1];
        }

        // b. Cek dari daftar knownCities
        if (!detectedCity) {
            for (const c of knownCities) {
                const regex = new RegExp(`\\b${c}\\b`, 'i');
                if (regex.test(delBlock)) {
                    detectedCity = c;
                    break;
                }
            }
        }

        // c. Fallback alias spesifik
        if (!detectedCity) {
            if (delBlock.includes("SARONGGI") || delBlock.includes("SUMENEP")) {
                detectedCity = "SUMENEP";
            }
        }

        if (!detectedCity) {
            detectedCity = "UNKNOWN";
        }

        const filename = `${poNumber} ${detectedCity}.pdf`;

        // 4. Ekstraksi halaman lossless dengan pdf-lib
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(sourceDoc, [i]);
        singleDoc.addPage(copiedPage);
        const singleBytes = await singleDoc.save();

        // 5. Simpan file ke seluruh output directory yang ditentukan
        for (const dir of outputDirs) {
            const targetFile = path.join(dir, filename);
            fs.writeFileSync(targetFile, singleBytes);
        }

        const item = {
            page: i + 1,
            poNumber,
            city: detectedCity,
            filename,
            addressSnippet: delLines.join(" ").replace(/DELIVERY ADDRESS\s*:\s*/i, "").trim().substring(0, 80)
        };

        summary.push(item);

        const level = detectedCity === 'UNKNOWN' ? 'warn' : 'success';
        onLog(`[${i + 1}/${pageCount}] Disimpan: ${filename}`, level);
        onProgress(i + 1, pageCount, item);
    }

    onLog(`[SELESAI] Berhasil memecah ${summary.length} halaman!`, 'done');
    return summary;
}

module.exports = { processPdfSplit };
