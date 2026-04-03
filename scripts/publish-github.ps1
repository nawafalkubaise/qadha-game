#Requires -Version 5.1
# Push qadha-game to GitHub in one step (after auth).
#  Run: & "C:\Program Files\GitHub CLI\gh.exe" auth login
#  Or:  $env:GITHUB_TOKEN = "ghp_...."   (classic PAT, repo scope)
#  Then: .\scripts\publish-github.ps1 [-RepoName qadha-game] [-Public]

param(
  [string]$RepoName = "qadha-game",
  [switch]$Public
)

$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli"
  exit 1
}

$workspace = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $workspace

function Test-GhAuth {
  $errPref = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  & $gh auth status 2>&1 | Out-Null
  $ok = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $errPref
  return $ok
}

if (-not (Test-GhAuth)) {
  $tok = $env:GITHUB_TOKEN
  if (-not $tok) {
    Write-Host "No GitHub session. Do ONE of:"
    Write-Host "  A) gh auth login"
    Write-Host "  B) Create PAT: https://github.com/settings/tokens (repo scope)"
    Write-Host "     `$env:GITHUB_TOKEN = 'ghp_...'"
    Write-Host "     .\scripts\publish-github.ps1"
    exit 1
  }
  $tok | & $gh auth login --hostname github.com --git-protocol https --with-token 2>$null | Out-Null
  if (-not (Test-GhAuth)) {
    Write-Error "Token login failed."
    exit 1
  }
}

$user = (& $gh api user -q .login).Trim()
if (-not $user) {
  Write-Error "Could not read GitHub username."
  exit 1
}

git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Pushing to existing origin..."
  git push -u origin HEAD
  Write-Host "Done."
  exit 0
}

$vis = if ($Public) { "--public" } else { "--private" }
Write-Host "Creating repo ${user}/${RepoName} and pushing..."
& $gh repo create $RepoName $vis --source=. --remote=origin --push
if ($LASTEXITCODE -ne 0) {
  Write-Host "Create failed; trying add origin + push..."
  git remote remove origin 2>$null | Out-Null
  git remote add origin ("https://github.com/{0}/{1}.git" -f $user, $RepoName)
  git push -u origin HEAD
  if ($LASTEXITCODE -ne 0) {
    exit 1
  }
}

Write-Host ("Repository: https://github.com/{0}/{1}" -f $user, $RepoName)
exit 0
