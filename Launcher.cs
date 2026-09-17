using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace PdfSplitterLauncher
{
    public class MainForm : Form
    {
        private Panel pnlHeader;
        private Label lblLogo;
        private Label lblTitle;
        private Label lblSubtitle;

        private Panel pnlStatusCard;
        private Label lblStatusDot;
        private Label lblStatusHeading;
        private Label lblStatusDesc;
        private Label lblFolderInfo;

        private Button btnStart;
        private Button btnStop;
        private Button btnOpenBrowser;
        private Button btnOpenFolder;

        private Panel pnlLogHeader;
        private Label lblLogTitle;
        private Button btnClearLog;
        private TextBox txtLog;

        private System.Windows.Forms.Timer checkTimer;
        private Process serverProcess = null;
        private const int SERVER_PORT = 4321;
        private const string SERVER_URL = "http://localhost:4321";
        private bool isStarting = false;

        private string docAntiPlengerPath;

        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (args.Length > 0 && args[0] == "--screenshot")
            {
                string outPath = args.Length > 1 ? args[1] : @"docs\exe_preview.png";
                using (MainForm f = new MainForm())
                {
                    f.Show();
                    Application.DoEvents();
                    Thread.Sleep(300);
                    using (Bitmap bmp = new Bitmap(f.Width, f.Height))
                    {
                        f.DrawToBitmap(bmp, new Rectangle(0, 0, f.Width, f.Height));
                        bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                    }
                }
                return;
            }

            Application.Run(new MainForm());
        }

        public MainForm()
        {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (string.IsNullOrEmpty(userProfile))
            {
                userProfile = Environment.GetEnvironmentVariable("USERPROFILE") ?? @"C:\Users\Default";
            }
            docAntiPlengerPath = Path.Combine(userProfile, "Documents", "anti plenger");

            InitializeComponent();
            PrintWelcomeBanner();
            CheckInitialStatus();

            checkTimer = new System.Windows.Forms.Timer();
            checkTimer.Interval = 1800;
            checkTimer.Tick += (s, e) => { CheckServerStatus(); };
            checkTimer.Start();
        }

        private void InitializeComponent()
        {
            this.Text = "PDF ANTI PLENGER";
            this.Size = new Size(540, 630);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(246, 248, 252); // Soft pastel background
            this.ForeColor = Color.FromArgb(30, 41, 59);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            // 1. HEADER PANEL (Clean pastel white with subtle lavender bottom border)
            pnlHeader = new Panel();
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 78;
            pnlHeader.BackColor = Color.White;
            pnlHeader.Paint += (s, e) =>
            {
                using (Pen pen = new Pen(Color.FromArgb(226, 232, 240), 1))
                {
                    e.Graphics.DrawLine(pen, 0, pnlHeader.Height - 1, pnlHeader.Width, pnlHeader.Height - 1);
                }
            };

            lblLogo = new Label();
            lblLogo.Text = "📑";
            lblLogo.Font = new Font("Segoe UI", 16F);
            lblLogo.Location = new Point(16, 17);
            lblLogo.Size = new Size(36, 36);

            lblTitle = new Label();
            lblTitle.Text = "PDF ANTI PLENGER";
            lblTitle.Font = new Font("Segoe UI", 13.5F, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(15, 23, 42); // Deep modern slate
            lblTitle.Location = new Point(54, 15);
            lblTitle.AutoSize = true;

            lblSubtitle = new Label();
            lblSubtitle.UseMnemonic = false;
            lblSubtitle.Text = "Aplikasi Otomasi Split & Auto-Rename PO Growell";
            lblSubtitle.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(100, 116, 139); // Slate-500
            lblSubtitle.Location = new Point(56, 43);
            lblSubtitle.AutoSize = true;

            pnlHeader.Controls.Add(lblLogo);
            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);

            // 2. STATUS CARD PANEL (Pastel Card with soft rounded-feel border)
            pnlStatusCard = new Panel();
            pnlStatusCard.Location = new Point(18, 94);
            pnlStatusCard.Size = new Size(488, 92);
            pnlStatusCard.BackColor = Color.White;
            pnlStatusCard.Paint += (s, e) =>
            {
                using (Pen pen = new Pen(Color.FromArgb(226, 232, 240), 1))
                {
                    e.Graphics.DrawRectangle(pen, 0, 0, pnlStatusCard.Width - 1, pnlStatusCard.Height - 1);
                }
            };

            lblStatusDot = new Label();
            lblStatusDot.Text = "●";
            lblStatusDot.Font = new Font("Segoe UI", 15F, FontStyle.Bold);
            lblStatusDot.ForeColor = Color.FromArgb(244, 63, 94); // Pastel Rose Red
            lblStatusDot.Location = new Point(14, 11);
            lblStatusDot.Size = new Size(24, 26);

            lblStatusHeading = new Label();
            lblStatusHeading.Text = "Server Offline";
            lblStatusHeading.Font = new Font("Segoe UI", 11F, FontStyle.Bold);
            lblStatusHeading.ForeColor = Color.FromArgb(244, 63, 94);
            lblStatusHeading.Location = new Point(40, 13);
            lblStatusHeading.AutoSize = true;

            lblStatusDesc = new Label();
            lblStatusDesc.Text = "Klik tombol Start Server untuk mulai menggunakan aplikasi.";
            lblStatusDesc.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblStatusDesc.ForeColor = Color.FromArgb(100, 116, 139);
            lblStatusDesc.Location = new Point(41, 38);
            lblStatusDesc.AutoSize = true;

            lblFolderInfo = new Label();
            lblFolderInfo.Text = "📁 Output: " + docAntiPlengerPath;
            lblFolderInfo.Font = new Font("Segoe UI Semibold", 8F, FontStyle.Bold);
            lblFolderInfo.ForeColor = Color.FromArgb(79, 70, 229); // Soft Indigo
            lblFolderInfo.Location = new Point(41, 62);
            lblFolderInfo.AutoSize = true;

            pnlStatusCard.Controls.Add(lblStatusDot);
            pnlStatusCard.Controls.Add(lblStatusHeading);
            pnlStatusCard.Controls.Add(lblStatusDesc);
            pnlStatusCard.Controls.Add(lblFolderInfo);

            // 3. ACTION BUTTONS (Bright Pastel Colors)
            // Row 1: START and STOP
            btnStart = new Button();
            btnStart.Text = "▶  START SERVER";
            btnStart.Location = new Point(18, 200);
            btnStart.Size = new Size(238, 44);
            btnStart.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            btnStart.BackColor = Color.FromArgb(16, 185, 129); // Pastel Mint/Emerald
            btnStart.ForeColor = Color.White;
            btnStart.FlatStyle = FlatStyle.Flat;
            btnStart.FlatAppearance.BorderSize = 0;
            btnStart.Cursor = Cursors.Hand;
            btnStart.Click += (s, e) => StartServer();

            btnStop = new Button();
            btnStop.Text = "⏹  STOP SERVER";
            btnStop.Location = new Point(268, 200);
            btnStop.Size = new Size(238, 44);
            btnStop.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            btnStop.BackColor = Color.FromArgb(244, 63, 94); // Pastel Rose/Coral
            btnStop.ForeColor = Color.White;
            btnStop.FlatStyle = FlatStyle.Flat;
            btnStop.FlatAppearance.BorderSize = 0;
            btnStop.Cursor = Cursors.Hand;
            btnStop.Enabled = false;
            btnStop.Click += (s, e) => StopServer();

            // Row 2: BUKA BROWSER and BUKA FOLDER OUTPUT
            btnOpenBrowser = new Button();
            btnOpenBrowser.Text = "🌐  Buka di Browser";
            btnOpenBrowser.Location = new Point(18, 254);
            btnOpenBrowser.Size = new Size(238, 40);
            btnOpenBrowser.Font = new Font("Segoe UI Semibold", 9.5F, FontStyle.Bold);
            btnOpenBrowser.BackColor = Color.FromArgb(59, 130, 246); // Pastel Sky Blue
            btnOpenBrowser.ForeColor = Color.White;
            btnOpenBrowser.FlatStyle = FlatStyle.Flat;
            btnOpenBrowser.FlatAppearance.BorderSize = 0;
            btnOpenBrowser.Cursor = Cursors.Hand;
            btnOpenBrowser.Enabled = false;
            btnOpenBrowser.Click += (s, e) => OpenBrowser();

            btnOpenFolder = new Button();
            btnOpenFolder.Text = "📁  Buka Folder Output";
            btnOpenFolder.Location = new Point(268, 254);
            btnOpenFolder.Size = new Size(238, 40);
            btnOpenFolder.Font = new Font("Segoe UI Semibold", 9.5F, FontStyle.Bold);
            btnOpenFolder.BackColor = Color.FromArgb(139, 92, 246); // Pastel Lavender/Violet
            btnOpenFolder.ForeColor = Color.White;
            btnOpenFolder.FlatStyle = FlatStyle.Flat;
            btnOpenFolder.FlatAppearance.BorderSize = 0;
            btnOpenFolder.Cursor = Cursors.Hand;
            btnOpenFolder.Click += (s, e) => OpenOutputFolder();

            // 4. LOG / TERMINAL CONSOLE (Clean, bright pastel card)
            pnlLogHeader = new Panel();
            pnlLogHeader.Location = new Point(18, 306);
            pnlLogHeader.Size = new Size(488, 26);

            lblLogTitle = new Label();
            lblLogTitle.Text = "Log Aktivitas Server:";
            lblLogTitle.Font = new Font("Segoe UI Semibold", 8.5F, FontStyle.Bold);
            lblLogTitle.ForeColor = Color.FromArgb(71, 85, 105);
            lblLogTitle.Location = new Point(0, 4);
            lblLogTitle.AutoSize = true;

            btnClearLog = new Button();
            btnClearLog.Text = "Bersihkan";
            btnClearLog.Size = new Size(70, 23);
            btnClearLog.Location = new Point(418, 1);
            btnClearLog.Font = new Font("Segoe UI", 8F);
            btnClearLog.BackColor = Color.FromArgb(241, 245, 249);
            btnClearLog.ForeColor = Color.FromArgb(100, 116, 139);
            btnClearLog.FlatStyle = FlatStyle.Flat;
            btnClearLog.FlatAppearance.BorderColor = Color.FromArgb(226, 232, 240);
            btnClearLog.FlatAppearance.BorderSize = 1;
            btnClearLog.Cursor = Cursors.Hand;
            btnClearLog.Click += (s, e) => { txtLog.Clear(); };

            pnlLogHeader.Controls.Add(lblLogTitle);
            pnlLogHeader.Controls.Add(btnClearLog);

            txtLog = new TextBox();
            txtLog.Location = new Point(18, 334);
            txtLog.Size = new Size(488, 238);
            txtLog.Multiline = true;
            txtLog.ScrollBars = ScrollBars.Vertical;
            txtLog.ReadOnly = true;
            txtLog.BackColor = Color.White; // Clean pastel white
            txtLog.ForeColor = Color.FromArgb(30, 41, 59); // Slate-800 crisp text
            txtLog.Font = new Font("Consolas", 8.5F, FontStyle.Regular);
            txtLog.BorderStyle = BorderStyle.FixedSingle;

            // Add all controls
            this.Controls.Add(pnlHeader);
            this.Controls.Add(pnlStatusCard);
            this.Controls.Add(btnStart);
            this.Controls.Add(btnStop);
            this.Controls.Add(btnOpenBrowser);
            this.Controls.Add(btnOpenFolder);
            this.Controls.Add(pnlLogHeader);
            this.Controls.Add(txtLog);

            this.FormClosing += MainForm_FormClosing;
        }

        private void PrintWelcomeBanner()
        {
            Log("===========================================================");
            Log("                 PDF ANTI PLENGER v1.0                     ");
            Log("         Otomasi Split & Auto-Rename PO Growell            ");
            Log("===========================================================");
            Log("[Lokasi Output] -> " + docAntiPlengerPath);
        }

        private void Log(string message)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action<string>(Log), message);
                return;
            }
            string time = DateTime.Now.ToString("HH:mm:ss");
            txtLog.AppendText("[" + time + "] " + message + Environment.NewLine);
            txtLog.SelectionStart = txtLog.TextLength;
            txtLog.ScrollToCaret();
        }

        private bool IsPortListening(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(400, false);
                    if (success && client.Connected)
                    {
                        client.EndConnect(result);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private void CheckInitialStatus()
        {
            Log("Memeriksa status layanan port " + SERVER_PORT + "...");
            CheckServerStatus();
        }

        private void CheckServerStatus()
        {
            if (isStarting) return;

            bool isRunning = IsPortListening(SERVER_PORT);
            UpdateUIState(isRunning);
        }

        private void UpdateUIState(bool isRunning)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action<bool>(UpdateUIState), isRunning);
                return;
            }

            if (isRunning)
            {
                lblStatusDot.ForeColor = Color.FromArgb(16, 185, 129); // Pastel Emerald
                lblStatusHeading.Text = "Server Aktif (Online)";
                lblStatusHeading.ForeColor = Color.FromArgb(16, 185, 129);
                lblStatusDesc.Text = "Aplikasi berjalan normal di: " + SERVER_URL;

                btnStart.Enabled = false;
                btnStart.BackColor = Color.FromArgb(203, 213, 225); // Soft Gray
                btnStart.ForeColor = Color.FromArgb(148, 163, 184);

                btnStop.Enabled = true;
                btnStop.BackColor = Color.FromArgb(244, 63, 94); // Pastel Rose
                btnStop.ForeColor = Color.White;

                btnOpenBrowser.Enabled = true;
                btnOpenBrowser.BackColor = Color.FromArgb(59, 130, 246); // Pastel Blue
                btnOpenBrowser.ForeColor = Color.White;
            }
            else
            {
                lblStatusDot.ForeColor = Color.FromArgb(244, 63, 94); // Pastel Rose
                lblStatusHeading.Text = "Server Offline";
                lblStatusHeading.ForeColor = Color.FromArgb(244, 63, 94);
                lblStatusDesc.Text = "Klik tombol Start Server untuk mulai menggunakan aplikasi.";

                btnStart.Enabled = true;
                btnStart.BackColor = Color.FromArgb(16, 185, 129); // Pastel Emerald
                btnStart.ForeColor = Color.White;

                btnStop.Enabled = false;
                btnStop.BackColor = Color.FromArgb(203, 213, 225); // Soft Gray
                btnStop.ForeColor = Color.FromArgb(148, 163, 184);

                btnOpenBrowser.Enabled = false;
                btnOpenBrowser.BackColor = Color.FromArgb(203, 213, 225); // Soft Gray
                btnOpenBrowser.ForeColor = Color.FromArgb(148, 163, 184);
            }
        }

        private void StartServer()
        {
            if (IsPortListening(SERVER_PORT))
            {
                Log("Server sudah aktif di port " + SERVER_PORT + ".");
                UpdateUIState(true);
                OpenBrowser();
                return;
            }

            isStarting = true;
            btnStart.Enabled = false;
            btnStop.Enabled = false;
            btnOpenBrowser.Enabled = false;

            lblStatusHeading.Text = "Sedang Memulai Server...";
            lblStatusHeading.ForeColor = Color.FromArgb(217, 119, 6); // Amber
            lblStatusDot.ForeColor = Color.FromArgb(217, 119, 6);
            lblStatusDesc.Text = "Menyiapkan server engine dan browser...";

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = Path.Combine(baseDir, "runtime", "node.exe");
            if (!File.Exists(nodePath))
            {
                nodePath = "node";
            }

            string scriptPath = Path.Combine(baseDir, "app_server.js");
            if (!File.Exists(scriptPath))
            {
                Log("ERROR: File 'app_server.js' tidak ditemukan!");
                MessageBox.Show(this, "File 'app_server.js' tidak ditemukan di folder:\n" + baseDir, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                isStarting = false;
                UpdateUIState(false);
                return;
            }

            Log("Memulai proses server: " + Path.GetFileName(nodePath) + " app_server.js");

            new Thread(() =>
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = nodePath;
                    psi.Arguments = "\"" + scriptPath + "\"";
                    psi.WorkingDirectory = baseDir;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.RedirectStandardOutput = true;
                    psi.RedirectStandardError = true;
                    psi.StandardOutputEncoding = Encoding.UTF8;
                    psi.StandardErrorEncoding = Encoding.UTF8;

                    serverProcess = new Process();
                    serverProcess.StartInfo = psi;
                    serverProcess.OutputDataReceived += (s, ev) =>
                    {
                        if (!string.IsNullOrEmpty(ev.Data)) Log("[Server] " + ev.Data);
                    };
                    serverProcess.ErrorDataReceived += (s, ev) =>
                    {
                        if (!string.IsNullOrEmpty(ev.Data)) Log("[Err] " + ev.Data);
                    };

                    serverProcess.Start();
                    serverProcess.BeginOutputReadLine();
                    serverProcess.BeginErrorReadLine();

                    // Tunggu respon port 4321
                    bool ready = false;
                    for (int i = 0; i < 20; i++)
                    {
                        Thread.Sleep(500);
                        if (IsPortListening(SERVER_PORT))
                        {
                            ready = true;
                            break;
                        }
                    }

                    this.BeginInvoke(new Action(() =>
                    {
                        isStarting = false;
                        if (ready)
                        {
                            Log("✓ Server SIAP! Membuka browser: " + SERVER_URL);
                            UpdateUIState(true);
                            OpenBrowser();
                        }
                        else
                        {
                            Log("! Server belum merespon di port " + SERVER_PORT);
                            UpdateUIState(IsPortListening(SERVER_PORT));
                        }
                    }));
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        isStarting = false;
                        Log("Gagal start server: " + ex.Message);
                        UpdateUIState(false);
                        MessageBox.Show(this, "Gagal menjalankan server:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }));
                }
            }).Start();
        }

        private void StopServer()
        {
            btnStop.Enabled = false;
            Log("Menghentikan server...");

            new Thread(() =>
            {
                try
                {
                    if (serverProcess != null && !serverProcess.HasExited)
                    {
                        try
                        {
                            serverProcess.Kill();
                            serverProcess.WaitForExit(2000);
                        }
                        catch { }
                        serverProcess = null;
                    }

                    KillProcessOnPort(SERVER_PORT);

                    Thread.Sleep(800);

                    this.BeginInvoke(new Action(() =>
                    {
                        Log("✓ Server telah dinonaktifkan (Port 4321 bebas).");
                        UpdateUIState(false);
                    }));
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        Log("Error saat stop server: " + ex.Message);
                        UpdateUIState(IsPortListening(SERVER_PORT));
                    }));
                }
            }).Start();
        }

        private void KillProcessOnPort(int port)
        {
            try
            {
                Process p = new Process();
                p.StartInfo.FileName = "netstat.exe";
                p.StartInfo.Arguments = "-ano -p tcp";
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.RedirectStandardOutput = true;
                p.StartInfo.CreateNoWindow = true;
                p.Start();
                string output = p.StandardOutput.ReadToEnd();
                p.WaitForExit(3000);

                string[] lines = output.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string line in lines)
                {
                    if (line.Contains(":" + port) && line.Contains("LISTENING"))
                    {
                        string[] parts = line.Trim().Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 5)
                        {
                            int pid;
                            if (int.TryParse(parts[parts.Length - 1], out pid) && pid > 0)
                            {
                                try
                                {
                                    Process procToKill = Process.GetProcessById(pid);
                                    procToKill.Kill();
                                }
                                catch { }
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private void OpenBrowser()
        {
            try
            {
                Process.Start(SERVER_URL);
            }
            catch (Exception ex)
            {
                Log("Gagal membuka browser: " + ex.Message);
            }
        }

        private void OpenOutputFolder()
        {
            try
            {
                if (!Directory.Exists(docAntiPlengerPath))
                {
                    Directory.CreateDirectory(docAntiPlengerPath);
                }
                Log("Membuka folder output di Windows Explorer: " + docAntiPlengerPath);
                Process.Start("explorer.exe", "\"" + docAntiPlengerPath + "\"");
            }
            catch (Exception ex)
            {
                Log("Gagal membuka folder: " + ex.Message);
            }
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (IsPortListening(SERVER_PORT))
            {
                DialogResult res = MessageBox.Show(this,
                    "Server PDF Anti Plenger masih aktif.\nApakah Anda ingin mematikan server sebelum keluar?",
                    "PDF ANTI PLENGER",
                    MessageBoxButtons.YesNoCancel,
                    MessageBoxIcon.Question);

                if (res == DialogResult.Cancel)
                {
                    e.Cancel = true;
                    return;
                }
                else if (res == DialogResult.Yes)
                {
                    try
                    {
                        if (serverProcess != null && !serverProcess.HasExited)
                        {
                            serverProcess.Kill();
                        }
                        KillProcessOnPort(SERVER_PORT);
                    }
                    catch { }
                }
            }
        }
    }
}
