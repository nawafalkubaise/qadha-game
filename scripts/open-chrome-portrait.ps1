# يفتح اللعبة في Chrome بنافذة ضيقة وطويلة (محاكاة جوال بالطول).
# استخدام: .\scripts\open-chrome-portrait.ps1 [-Port 5173] [-Tabs]
param(
  [int]$Port = 5173,
  [switch]$Tabs
)

$url = "http://127.0.0.1:$Port/"

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  Write-Host 'Chrome not found. Install Google Chrome.' -ForegroundColor Red
  exit 1
}

# عرض × ارتفاع: العرض أصغر من الارتفاع = شكل طولي (Portrait)
$w = 390
$h = 900

if ($Tabs) {
  Start-Process -FilePath $chrome -ArgumentList @(
    "--window-size=$w,$h",
    "--window-position=120,48",
    $url
  )
  Write-Host "Chrome tabs ${w}x${h} -> $url" -ForegroundColor Green
} else {
  # --app نافذة بلا شريط تبويبات (أقرب لتجربة تطبيق على الهاتف)
  Start-Process -FilePath $chrome -ArgumentList @(
    "--app=$url",
    "--window-size=$w,$h",
    "--window-position=120,48"
  )
  Write-Host "Chrome app window ${w}x${h} -> $url" -ForegroundColor Green
  Write-Host 'Tabs mode: npm run open:chrome:portrait:tabs' -ForegroundColor DarkGray
}
