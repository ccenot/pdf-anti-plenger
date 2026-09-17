Set WshShell = CreateObject("WScript.Shell")
strPath = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
WshShell.CurrentDirectory = strPath

' Jalankan server tanpa memunculkan jendela hitam cmd (0 = hide)
WshShell.Run "cmd /c """ & strPath & "Jalankan_PDF_Anti_Plenger.bat""", 0, False
