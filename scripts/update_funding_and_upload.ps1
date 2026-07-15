$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot\..").Path
$dataFile = Join-Path $root 'data\funding_opportunities.json'
$python = (Get-Command python -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

if (-not $env:BIZINFO_API_KEY) {
    $env:BIZINFO_API_KEY = [Environment]::GetEnvironmentVariable('BIZINFO_API_KEY', 'User')
}
if (-not $env:BIZINFO_API_KEY) {
    throw 'BIZINFO_API_KEY is not configured.'
}

& $python (Join-Path $PSScriptRoot 'update_funding_opportunities.py')
if ($LASTEXITCODE -ne 0) {
    throw "Funding update failed with exit code $LASTEXITCODE."
}

Push-Location $root
try {
    & $npm exec -- wrangler r2 object put healtharchive-assets/protected/funding-opportunities.json --file $dataFile --remote
    if ($LASTEXITCODE -ne 0) {
        throw "Funding upload failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
