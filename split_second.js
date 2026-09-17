const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const PDFParser = require('pdf2json');

const sourcePdfPath = 'C:/Users/notnot/Downloads/po growel 15 september 2025 ke 2.pdf';
const outDir = 'C:/Users/notnot/Documents/PDF/hasil_split_po_ke_2';

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const knownCities = [
    "BANJARNEGARA", "KARANGANYAR", "PAMEKASAN", "BANGKALAN", "SUMENEP", 
    "SAMPANG", "JEMBER", "MALANG", "PASURUAN", "BOYOLALI", "SLEMAN", 
    "CILACAP", "TUBAN", "MADIUN", "SIDOARJO", "GRESIK", "MAGELANG", 
    "SURABAYA", "KEDIRI", "BLITAR", "PROBOLINGGO", "BANYUWANGI", "BONDOWOSO",
    "SEMARANG", "SOLO", "SURAKARTA", "YOGYAKARTA", "KLATEN", "SUKOHARJO", "WONOGIRI",
    "KUDUS", "PATI", "JEPARA", "REMBANG", "BLORA", "GROBOGAN", "PURWODADI",
    "KENDAL", "BATANG", "PEKALONGAN", "PEMALANG", "TEGAL", "BREBES", "PURBALINGGA",
    "BANYUMAS", "PURWOKERTO", "KEBUMEN", "PURWOREJO", "WONOSOBO", "TEMANGGUNG"
];

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => {
    console.error("Parser error:", errData.parserError);
    process.exit(1);
});

pdfParser.on("pdfParser_dataReady", async pdfData => {
    try {
        const sourceBytes = fs.readFileSync(sourcePdfPath);
        const sourceDoc = await PDFDocument.load(sourceBytes);
        const pageCount = sourceDoc.getPageCount();
        console.log(`Processing "${sourcePdfPath}" - Total pages: ${pageCount}`);

        const summary = [];

        for (let i = 0; i < pageCount; i++) {
            const pageData = pdfData.Pages[i];
            
            const texts = pageData.Texts.map(t => {
                const str = decodeURIComponent(t.R.map(r => r.T).join(""));
                return { x: t.x, y: t.y, text: str };
            });
            texts.sort((a, b) => (Math.abs(a.y - b.y) > 0.3 ? a.y - b.y : a.x - b.x));
            
            const lines = [];
            let cur = [];
            let ly = -1;
            for (let t of texts) {
                if (ly === -1 || Math.abs(t.y - ly) < 0.3) cur.push(t.text);
                else { lines.push(cur.join(" ")); cur = [t.text]; }
                ly = t.y;
            }
            if (cur.length) lines.push(cur.join(" "));
            const fullText = lines.join("\n");

            // PO Number
            const poMatch = fullText.match(/No\.?\s*(\d{10})/i);
            const poNumber = poMatch ? poMatch[1] : `PO_${i + 1}`;

            // Extract ONLY the delivery address block
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
            const delBlock = delLines.join(" ").toUpperCase();

            // Detect City
            let detectedCity = "";

            const kabMatch = delBlock.match(/KAB(?:UPATEN)?\.?\s+([A-Z]+)/);
            if (kabMatch && knownCities.includes(kabMatch[1])) {
                detectedCity = kabMatch[1];
            }

            if (!detectedCity) {
                const normalizedBlock = delBlock.replace(/MAGELAN\s+G/g, "MAGELANG");
                for (const c of knownCities) {
                    const regex = new RegExp(`\\b${c}\\b`, 'i');
                    if (regex.test(normalizedBlock)) {
                        detectedCity = c;
                        break;
                    }
                }
            }

            if (!detectedCity && (delBlock.includes("SARONGGI") || delBlock.includes("SUMENEP"))) {
                detectedCity = "SUMENEP";
            }

            if (!detectedCity) {
                detectedCity = "UNKNOWN";
            }

            const filename = `${poNumber} ${detectedCity}.pdf`;

            // Extract single page with pdf-lib (lossless vector PDF)
            const singleDoc = await PDFDocument.create();
            const [copiedPage] = await singleDoc.copyPages(sourceDoc, [i]);
            singleDoc.addPage(copiedPage);
            const singleBytes = await singleDoc.save();

            const targetFile = path.join(outDir, filename);
            fs.writeFileSync(targetFile, singleBytes);

            summary.push({
                Halaman: i + 1,
                "Nomor PO": poNumber,
                "Kota Tujuan": detectedCity,
                "Nama File": filename,
                "Alamat Lengkap": delBlock.replace(/DELIVERY ADDRESS\s*:\s*/i, "").trim()
            });

            console.log(`[${i + 1}/${pageCount}] Selesai: ${filename}`);
        }

        console.log("\n=== HASIL PEMOTONGAN PO KE 2 ===");
        console.table(summary.map(s => ({
            Halaman: s.Halaman,
            "Nomor PO": s["Nomor PO"],
            "Kota Tujuan": s["Kota Tujuan"],
            "Nama File": s["Nama File"]
        })));

        console.log(`\nBerhasil! Seluruh ${pageCount} file tersimpan di: ${outDir}`);
    } catch (e) {
        console.error("Error during splitting:", e);
        process.exit(1);
    }
});

pdfParser.loadPDF(sourcePdfPath);
