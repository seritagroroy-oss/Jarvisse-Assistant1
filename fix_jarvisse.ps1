$path = 'e:\Jarvisse Assistant 04 04 26\mon-ai-site\client\App.jsx'
$content = Get-Content $path
$newContent = $content -replace 'import\.meta\.env\.VITE_BACKEND_URL \|\| ""', 'import.meta.env.VITE_BACKEND_URL || "https://jarvisse-assistant1.vercel.app"'
$newContent | Set-Content $path

$mainPath = 'e:\Jarvisse Assistant 04 04 26\mon-ai-site\electron-main.cjs'
$mainContent = Get-Content $mainPath
$mainNew = $mainContent -replace 'contextIsolation: false', 'contextIsolation: false, webSecurity: false'
$mainNew | Set-Content $mainPath

Write-Host "PROTOCOLE DE RÉPARATION RÉUSSI"
