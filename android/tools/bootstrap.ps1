$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectDir '.tools'
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null

# Local, isolated build dependencies: no installer, PATH edits or global configuration.
$packages = @(
    @{Name='jdk'; Url='https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip'; Hash='e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0'; Algorithm='SHA256'},
    @{Name='platform'; Url='https://dl.google.com/android/repository/platform-36_r02.zip'; Hash='2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576'; Algorithm='SHA1'},
    @{Name='build-tools'; Url='https://dl.google.com/android/repository/build-tools_r36_windows.zip'; Hash='f16ccffd34de8790dede813a6c7d8e2c11a27b50'; Algorithm='SHA1'}
)
foreach ($package in $packages) {
    $destination = Join-Path $toolsDir $package.Name
    if (Test-Path -LiteralPath (Join-Path $destination '.complete')) { continue }
    $archive = Join-Path $toolsDir ($package.Name + '.zip')
    if (!(Test-Path -LiteralPath $archive)) {
        Write-Host ('Downloading ' + $package.Name)
        Invoke-WebRequest -Uri $package.Url -OutFile $archive -UseBasicParsing
    }
    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm $package.Algorithm).Hash
    if ($actualHash -ne $package.Hash) { throw ('Invalid package checksum: ' + $package.Name) }
    Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
    New-Item -ItemType File -Path (Join-Path $destination '.complete') -Force | Out-Null
}
Write-Host 'Build dependencies ready. They are only used by this project.'
