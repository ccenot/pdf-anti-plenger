param(
    [string]$Type = "file",
    [string]$InitialDir = ""
)

[System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null

if ($Type -eq "file") {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "Pilih File PDF Sumber"
    $dialog.Filter = "File PDF (*.pdf)|*.pdf|Semua File (*.*)|*.*"
    if ($InitialDir -and (Test-Path $InitialDir)) {
        $dialog.InitialDirectory = $InitialDir
    }
    $form = New-Object System.Windows.Forms.Form
    $form.TopMost = $true
    $result = $dialog.ShowDialog($form)
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        [Console]::WriteLine($dialog.FileName)
    }
} elseif ($Type -eq "folder") {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Pilih Folder Tujuan Penyimpanan"
    if ($InitialDir -and (Test-Path $InitialDir)) {
        $dialog.SelectedPath = $InitialDir
    }
    $form = New-Object System.Windows.Forms.Form
    $form.TopMost = $true
    $result = $dialog.ShowDialog($form)
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        [Console]::WriteLine($dialog.SelectedPath)
    }
}
