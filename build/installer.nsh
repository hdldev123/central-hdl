; Desinstalar a Central leva junto os apps que ela instalou (%LOCALAPPDATA%\Central HDL\apps) e o
; registro das notificações deles. Na atualização da própria Central o desinstalador antigo também
; roda, com --updated: aí não mexe nos apps.
;
; O desinstalador é de 32 bits: o PowerShell que ele chama também, e nele o Get-Process não mostra o
; caminho de processos de 64 bits. Por isso Win32_Process (como o próprio electron-builder faz).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    Push $0
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "$$apps = $$env:LOCALAPPDATA + '\Central HDL\apps\';Get-CimInstance -ClassName Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$apps, 'CurrentCultureIgnoreCase') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-ChildItem -Path $$apps -Filter instalado.json -Recurse -Depth 1 -ErrorAction SilentlyContinue | ForEach-Object { $$id = (Get-Content -LiteralPath $$_.FullName -Raw | ConvertFrom-Json).appId; if ($$id -match '^[\w.-]{1,128}$$') { Remove-Item -LiteralPath ('HKCU:\Software\Classes\AppUserModelId\' + $$id) -Recurse -Force -ErrorAction SilentlyContinue } }"`
    Pop $0
    Pop $0
    Sleep 1000
    RMDir /r "$LOCALAPPDATA\Central HDL\apps"
    RMDir "$LOCALAPPDATA\Central HDL"
  ${endIf}
!macroend
