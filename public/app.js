// PDF ANTI PLENGER - Frontend Application Logic
// Created by Cenot (TikTok: @ccenot)

(function() {
  let appConfig = null;
  let selectedPdfPath = '';
  let isProcessing = false;
  let currentSummary = [];

  // DOM Elements
  const btnStartSplit = document.getElementById('btn-start-split');
  const btnSplitLabel = document.getElementById('btn-split-label');
  const btnClearFile = document.getElementById('btn-clear-file');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const btnExportCsv = document.getElementById('btn-export-csv');

  const pdfDropzone = document.getElementById('pdf-dropzone');
  const fileInputNative = document.getElementById('file-input-native');
  const filePreviewBanner = document.getElementById('file-preview-banner');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFilePath = document.getElementById('selected-file-path');
  const selectedFileSize = document.getElementById('selected-file-size');
  const manualFilePathInput = document.getElementById('manual-file-path-input');
  const btnApplyPath = document.getElementById('btn-apply-path');

  const outputDirInput = document.getElementById('output-dir-input');
  const destFolderDisplay = document.getElementById('dest-folder-display');
  const btnOpenTargetFolder = document.getElementById('btn-open-target-folder');

  const progressSection = document.getElementById('progress-section');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressStatsBadge = document.getElementById('progress-stats-badge');
  const consoleOutput = document.getElementById('console-output');

  const resultsSection = document.getElementById('results-section');
  const resultsTableBody = document.getElementById('results-table-body');
  const totalPagesCount = document.getElementById('total-pages-count');
  const successCityCount = document.getElementById('success-city-count');
  const unknownCityCount = document.getElementById('unknown-city-count');

  const cityCountBadge = document.getElementById('city-count-badge');
  const newCityInput = document.getElementById('new-city-input');
  const btnAddCity = document.getElementById('btn-add-city');
  const filterCityInput = document.getElementById('filter-city-input');
  const cityChipsContainer = document.getElementById('city-chips-container');
  const btnResetCities = document.getElementById('btn-reset-cities');

  const sysStatusPill = document.getElementById('sys-status-pill');
  const sysStatusText = document.getElementById('sys-status-text');

  function getAutoOutputDir() {
    return (appConfig && appConfig.systemPresets && appConfig.systemPresets.documents)
      || (appConfig && appConfig.defaultOutputDir)
      || '';
  }

  // --- 1. INITIALIZATION ---
  async function init() {
    await fetchConfig();
    setupEventListeners();
  }

  // Load config from server
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      appConfig = await res.json();
      
      const targetDir = getAutoOutputDir();
      if (outputDirInput) {
        outputDirInput.value = targetDir;
      }
      if (destFolderDisplay && targetDir) {
        const winDisplay = targetDir.replace(/\//g, '\\');
        destFolderDisplay.textContent = winDisplay;
        destFolderDisplay.title = "Lokasi: " + winDisplay;
      }

      renderCityChips();
    } catch (e) {
      showToast("Gagal memuat konfigurasi: " + e.message, "error");
    }
  }

  // Save config back to server
  async function saveConfig() {
    if (!appConfig) return;
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appConfig)
      });
    } catch (e) {
      console.error("Gagal simpan konfigurasi:", e);
    }
  }

  // --- 2. CITY CHIPS MANAGEMENT ---
  function renderCityChips(filterQuery = '') {
    if (!appConfig || !appConfig.knownCities) return;
    
    cityChipsContainer.innerHTML = '';
    const q = filterQuery.trim().toUpperCase();
    const cities = appConfig.knownCities.filter(c => !q || c.toUpperCase().includes(q));

    cityCountBadge.textContent = `${appConfig.knownCities.length} Kota`;

    cities.forEach(city => {
      const chip = document.createElement('div');
      chip.className = 'city-chip';
      chip.innerHTML = `
        <span>${escapeHtml(city)}</span>
        <span class="city-chip-remove" title="Hapus ${escapeHtml(city)}">&times;</span>
      `;

      chip.querySelector('.city-chip-remove').addEventListener('click', () => {
        removeCity(city);
      });

      cityChipsContainer.appendChild(chip);
    });
  }

  function addCity(city) {
    const clean = city.trim().toUpperCase();
    if (!clean) return;
    if (!appConfig.knownCities.includes(clean)) {
      appConfig.knownCities.push(clean);
      saveConfig();
      renderCityChips(filterCityInput.value);
      showToast(`Kota "${clean}" ditambahkan.`);
    } else {
      showToast(`Kota "${clean}" sudah ada dalam daftar.`, "warn");
    }
    newCityInput.value = '';
  }

  function removeCity(city) {
    appConfig.knownCities = appConfig.knownCities.filter(c => c !== city);
    saveConfig();
    renderCityChips(filterCityInput.value);
  }

  // --- 3. FILE SELECTION & UPLOAD HANDLERS ---
  async function selectFile(filePath) {
    if (!filePath) return;
    try {
      const res = await fetch('/api/inspect-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      const data = await res.json();

      if (data.exists && data.isFile) {
        selectedPdfPath = data.cleanPath || filePath;
        selectedFileName.textContent = data.name;
        selectedFilePath.textContent = selectedPdfPath;
        selectedFileSize.textContent = formatBytes(data.sizeBytes);
        manualFilePathInput.value = selectedPdfPath;
        
        pdfDropzone.style.display = 'none';
        filePreviewBanner.style.display = 'flex';
        btnStartSplit.disabled = false;
        showToast(`File "${data.name}" siap diproses!`);
      } else {
        showToast("File tidak ditemukan pada path yang diberikan.", "error");
      }
    } catch (e) {
      showToast("Gagal memeriksa file: " + e.message, "error");
    }
  }

  async function uploadFileBlob(file) {
    if (!file) return;
    showToast("Mengunggah berkas PDF...");
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name)
        },
        body: file
      });
      const data = await res.json();
      if (data.success && data.filePath) {
        selectFile(data.filePath);
      } else {
        showToast("Gagal upload: " + (data.error || "Unknown error"), "error");
      }
    } catch (e) {
      showToast("Gagal mengirim berkas ke server: " + e.message, "error");
    }
  }

  function clearFile() {
    selectedPdfPath = '';
    filePreviewBanner.style.display = 'none';
    pdfDropzone.style.display = 'block';
    btnStartSplit.disabled = true;
    manualFilePathInput.value = '';
  }

  // --- 4. WINDOWS EXPLORER & FOLDER ACTIONS ---
  async function triggerBrowseFile() {
    try {
      showToast("Membuka File Explorer Windows...");
      const res = await fetch('/api/browse-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialDir: outputDirInput.value })
      });
      const data = await res.json();
      if (data && data.filePath) {
        selectFile(data.filePath);
      }
    } catch (e) {
      showToast("Gagal membuka dialog file: " + e.message, "error");
    }
  }

  async function triggerBrowseFolder() {
    try {
      showToast("Membuka dialog pilih folder...");
      const res = await fetch('/api/browse-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialDir: outputDirInput.value })
      });
      const data = await res.json();
      if (data && data.folderPath) {
        outputDirInput.value = data.folderPath;
        if (appConfig) {
          appConfig.defaultOutputDir = data.folderPath;
          saveConfig();
        }
        showToast("Folder tujuan diubah.");
      }
    } catch (e) {
      showToast("Gagal membuka dialog folder: " + e.message, "error");
    }
  }

  async function triggerOpenFolder(customPath) {
    const target = (customPath || outputDirInput.value || '').trim();
    if (!target) {
      showToast("Tentukan folder tujuan terlebih dahulu!", "warn");
      return;
    }
    showToast("Membuka folder di File Explorer...");
    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: target })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast("Jendela folder File Explorer telah dibuka!");
      }
    } catch (e) {
      showToast("Gagal membuka folder: " + e.message, "error");
    }
  }

  // --- 5. SPLIT PROCESS WITH SSE REALTIME STREAM ---
  function startPdfSplit() {
    if (isProcessing) return;
    if (!selectedPdfPath) {
      showToast("Pilih file PDF terlebih dahulu!", "warn");
      return;
    }
    const outputDir = getAutoOutputDir() || (outputDirInput ? outputDirInput.value.trim() : '');
    if (!outputDir) {
      showToast("Lokasi penyimpanan tidak terdeteksi!", "warn");
      return;
    }

    // Prepare UI for processing
    isProcessing = true;
    currentSummary = [];
    btnStartSplit.disabled = true;
    btnSplitLabel.textContent = "Sedang Memproses Split & Rename...";

    sysStatusPill.style.background = "var(--amber-bg)";
    sysStatusPill.style.borderColor = "var(--amber-border)";
    sysStatusPill.style.color = "var(--amber)";
    sysStatusText.textContent = "Memproses...";

    progressSection.style.display = 'block';
    resultsSection.style.display = 'block';
    progressBarFill.style.width = '0%';
    progressStatsBadge.textContent = 'Menyiapkan...';
    resultsTableBody.innerHTML = '';
    consoleOutput.innerHTML = '';

    addLogLine(`[MULAI] Menghubungkan ke engine split...`, 'info');

    // Save chosen output dir in config
    if (appConfig) {
      appConfig.defaultOutputDir = outputDir;
      saveConfig();
    }

    const sseUrl = `/api/split-stream?source=${encodeURIComponent(selectedPdfPath)}&output=${encodeURIComponent(outputDir)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      addLogLine(data.text, data.level);
    });

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      const { current, total, item } = data;
      const pct = Math.round((current / total) * 100);

      progressBarFill.style.width = `${pct}%`;
      progressStatsBadge.textContent = `${current} / ${total} Halaman (${pct}%)`;

      currentSummary.push(item);
      addTableRow(item);
      updateSummaryMetrics();
    });

    eventSource.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      eventSource.close();
      finishProcessing(true, `Selesai! Berhasil memecah ${data.total} halaman.`);
    });

    eventSource.addEventListener('error', (e) => {
      eventSource.close();
      let msg = "Terjadi kesalahan saat pemrosesan.";
      if (e.data) {
        try { msg = JSON.parse(e.data).message || msg; } catch(_) {}
      }
      addLogLine(`[ERROR] ${msg}`, 'error');
      finishProcessing(false, msg);
    });
  }

  function finishProcessing(success, message) {
    isProcessing = false;
    btnStartSplit.disabled = false;
    btnSplitLabel.textContent = "Mulai Split & Auto-Rename PDF";

    if (success) {
      sysStatusPill.style.background = "var(--emerald-bg)";
      sysStatusPill.style.borderColor = "var(--emerald-border)";
      sysStatusPill.style.color = "var(--emerald)";
      sysStatusText.textContent = "Selesai Sukses";
      showToast(message);
      const targetDir = getAutoOutputDir();
      if (targetDir) {
        setTimeout(() => {
          showToast(`File tersimpan di: ${targetDir.replace(/\//g, '\\')}`);
        }, 700);
      }
      playSuccessChime();
    } else {
      sysStatusPill.style.background = "var(--rose-bg)";
      sysStatusPill.style.borderColor = "var(--rose-border)";
      sysStatusPill.style.color = "var(--rose)";
      sysStatusText.textContent = "Gagal";
      showToast(message, "error");
    }
  }

  // --- 6. TABLE & METRICS ---
  function addTableRow(item) {
    const tr = document.createElement('tr');
    const isUnknown = item.city === 'UNKNOWN';
    
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-weight: 600;">${item.page}</td>
      <td><span class="po-badge">${escapeHtml(item.poNumber)}</span></td>
      <td>
        <span class="city-pill ${isUnknown ? 'unknown' : ''}">
          ${escapeHtml(item.city)}
        </span>
      </td>
      <td><span class="filename-code">${escapeHtml(item.filename)}</span></td>
      <td class="address-cell" title="${escapeHtml(item.addressSnippet)}">${escapeHtml(item.addressSnippet || '-')}</td>
    `;
    resultsTableBody.appendChild(tr);
  }

  function updateSummaryMetrics() {
    const total = currentSummary.length;
    const unknown = currentSummary.filter(i => i.city === 'UNKNOWN').length;
    const success = total - unknown;

    totalPagesCount.textContent = total;
    successCityCount.textContent = success;
    unknownCityCount.textContent = unknown;
  }

  function addLogLine(text, level = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${level}`;
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // --- 7. EXPORT SUMMARY TO CSV ---
  function exportToCsv() {
    if (!currentSummary.length) {
      showToast("Belum ada data untuk diekspor!", "warn");
      return;
    }
    const headers = ["Halaman", "Nomor PO", "Kota Tujuan", "Nama File", "Cuplikan Alamat"];
    const rows = currentSummary.map(it => [
      it.page,
      `"${it.poNumber}"`,
      `"${it.city}"`,
      `"${it.filename}"`,
      `"${(it.addressSnippet || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Split_PO_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("File CSV berhasil diunduh.");
  }

  // --- 8. AUDIO CHIME (Web Audio API) ---
  function playSuccessChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  // --- 9. EVENT LISTENERS SETUP ---
  function setupEventListeners() {
    btnClearFile.addEventListener('click', clearFile);
    btnClearLogs.addEventListener('click', () => { consoleOutput.innerHTML = ''; });
    btnExportCsv.addEventListener('click', exportToCsv);
    btnStartSplit.addEventListener('click', startPdfSplit);

    // Tombol Cepat Buka Folder Tujuan Penyimpanan
    if (btnOpenTargetFolder) {
      btnOpenTargetFolder.addEventListener('click', () => {
        const target = getAutoOutputDir();
        if (target) {
          triggerOpenFolder(target);
        } else {
          showToast("Lokasi folder belum tersedia.", "warn");
        }
      });
    }

    const btnOpenResultsFolder = document.getElementById('btn-open-results-folder');
    if (btnOpenResultsFolder) {
      btnOpenResultsFolder.addEventListener('click', () => {
        const target = getAutoOutputDir();
        if (target) {
          triggerOpenFolder(target);
        } else {
          showToast("Lokasi folder belum tersedia.", "warn");
        }
      });
    }

    // Apply manual path
    btnApplyPath.addEventListener('click', () => {
      const p = manualFilePathInput.value.trim().replace(/^["']|["']$/g, '');
      if (p) selectFile(p);
      else showToast("Masukkan path file PDF terlebih dahulu!", "warn");
    });
    manualFilePathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const p = manualFilePathInput.value.trim().replace(/^["']|["']$/g, '');
        if (p) selectFile(p);
      }
    });

    // Dropzone click -> trigger hidden native file input
    pdfDropzone.addEventListener('click', () => {
      fileInputNative.value = null;
      fileInputNative.click();
    });
    
    // Native HTML5 file input selection -> auto upload & load
    fileInputNative.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        uploadFileBlob(file);
      }
    });

    // Drag and Drop handlers
    ['dragenter', 'dragover'].forEach(eventName => {
      pdfDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        pdfDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      pdfDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        pdfDropzone.classList.remove('dragover');
      });
    });

    pdfDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.pdf')) {
          uploadFileBlob(file);
        } else {
          showToast("Mohon pilih berkas dengan format .PDF", "warn");
        }
      }
    });

    // Add city listeners
    btnAddCity.addEventListener('click', () => addCity(newCityInput.value));
    newCityInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCity(newCityInput.value);
    });

    filterCityInput.addEventListener('input', (e) => {
      renderCityChips(e.target.value);
    });

    btnResetCities.addEventListener('click', async () => {
      if (confirm("Reset daftar kota ke daftar awal standar?")) {
        const defaults = [
          "BOJONEGORO",
          "LAMONGAN",
          "PONOROGO",
          "MAGETAN",
          "CURAH JATIM",
          "MOJOKERTO",
          "GOLOMANTUNG",
          "MADIUN",
          "NGAWI",
          "LEGUNDI",
          "SURABAYA",
          "TUBAN",
          "MALANG 2",
          "MALANG 1",
          "NGANJUK",
          "SIDAYU",
          "PROBOLINGGO",
          "PARE KEDIRI",
          "KEDIRI",
          "LUMAJANG",
          "JEMBER",
          "SITUBONDO",
          "JOMBANG",
          "BANYUWANGI",
          "TRENGGALEK",
          "BLITAR",
          "BONDOWOSO",
          "TULUNGAGUNG",
          "KLUNGKUNG",
          "DENPASAR",
          "SINGARAJA",
          "TABANAN",
          "PASURUAN",
          "NGADULIWEH KEDIRI",
          "TASIKMALAYA",
          "PANGANDARAN",
          "BANJAR",
          "SIDOARJO",
          "SUMENEP",
          "SAMPANG",
          "PAMEKASAN",
          "BANGKALAN",
          "PATI",
          "SALATIGA",
          "PURWODADI",
          "PALUR",
          "SLEMAN",
          "KEBUMEN",
          "SID SRAGEN",
          "CILACAP",
          "WONOGIRI",
          "BANTUL",
          "BOYOLALI",
          "SUKOHARJO",
          "SAYUNG",
          "KLATEN",
          "SID KULONPROGO",
          "UNGARAN",
          "MAGELANG",
          "CEPU",
          "KENDAL",
          "GUDANG",
          "PURWOREJO",
          "PURWOKERTO",
          "KULONPROGO",
          "BLORA",
          "REMBANG",
          "DEMAK",
          "BANJARNEGARA",
          "JEPARA",
          "PEKALONGAN",
          "TEGAL",
          "MALANG",
          "KARANGANYAR",
          "GRESIK",
          "BANYUMAS",
          "SRAGEN",
          "SEMARANG",
          "SOLO",
          "SURAKARTA",
          "YOGYAKARTA",
          "KUDUS",
          "BREBES",
          "PURBALINGGA",
          "BATANG",
          "PEMALANG"
];
        appConfig.knownCities = defaults;
        saveConfig();
        renderCityChips();
        showToast("Daftar kota berhasil di-reset.");
      }
    });
  }

  // --- 10. UTILITIES ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let color = '#00f2fe';
    if (type === 'warn') color = '#f59e0b';
    if (type === 'error') color = '#f43f5e';
    
    toast.innerHTML = `<span style="color:${color}; font-weight:bold;">●</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
