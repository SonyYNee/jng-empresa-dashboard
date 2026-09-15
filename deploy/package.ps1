$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactsRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactsRoot | Out-Null
$stagingRoot = Join-Path $artifactsRoot ('deploy-' + [guid]::NewGuid().ToString('N'))
$dashboardRoot = Join-Path $stagingRoot 'dashboard'
$landingRoot = Join-Path $stagingRoot 'landing'
New-Item -ItemType Directory -Force -Path (Join-Path $dashboardRoot 'apps/dashboard'), $landingRoot | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json'), (Join-Path $projectRoot 'package-lock.json') -Destination $dashboardRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/dashboard/src'), (Join-Path $projectRoot 'apps/dashboard/public') -Destination (Join-Path $dashboardRoot 'apps/dashboard') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'dashboard/vertracloud.config') -Destination $dashboardRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/landing/server.js'), (Join-Path $projectRoot 'apps/landing/dist') -Destination $landingRoot -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'landing/vertracloud.config') -Destination $landingRoot
[IO.File]::WriteAllText((Join-Path $landingRoot 'package.json'), '{"name":"jng-landing","private":true,"type":"module","scripts":{"start":"node server.js"},"engines":{"node":">=22.13.0"}}')

# Pacotes de código não incluem banco, uploads ou credenciais. Mídias existentes exigem migração separada.
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($application in @('dashboard', 'landing')) {
  $archive = Join-Path $artifactsRoot ($application + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
  $sourceRoot = [IO.Path]::GetFullPath((Join-Path $stagingRoot $application))
  $zip = [IO.Compression.ZipFile]::Open($archive, 'Create')
  try {
    Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | ForEach-Object {
      $entryName = $_.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName) | Out-Null
    }
  } finally {
    $zip.Dispose()
  }
  Write-Output $archive
}
