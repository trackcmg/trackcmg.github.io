$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDir
$jdkDir = (Get-ChildItem -LiteralPath '.tools\jdk' -Directory | Select-Object -First 1).FullName
$androidJar = (Get-ChildItem -LiteralPath '.tools\platform' -Recurse -Filter android.jar | Select-Object -First 1).FullName
$testDir = Join-Path $projectDir ('build\tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir -Force | Out-Null
$mainFiles = @('app\src\io\github\trackcmg\salud\ScanWindow.java','app\src\io\github\trackcmg\salud\HealthTypes.java')
$testFiles = Get-ChildItem -LiteralPath 'tests' -Filter *.java | ForEach-Object FullName
& (Join-Path $jdkDir 'bin\javac.exe') -encoding UTF-8 -classpath $androidJar -d $testDir @mainFiles @testFiles
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
foreach ($testClass in @('ScanWindowTest','HealthTypesTest')) {
    & (Join-Path $jdkDir 'bin\java.exe') -cp ($testDir + ';' + $androidJar) ('io.github.trackcmg.salud.' + $testClass)
    if ($LASTEXITCODE -ne 0) { throw ('Test failed: ' + $testClass) }
}
[xml]$manifest = Get-Content -LiteralPath 'app\AndroidManifest.xml' -Raw
$declared = @($manifest.manifest.'uses-permission' | ForEach-Object { $_.GetAttribute('name','http://schemas.android.com/apk/res/android') })
$syncPermissions=@('android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE','android.permission.RECEIVE_BOOT_COMPLETED','android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND')
if ($declared.Count -ne 25 -or ($declared | Where-Object { $_ -notlike 'android.permission.health.READ_*' -and $_ -notin $syncPermissions })) {
    throw 'Unexpected manifest permissions: Health Connect must stay read-only'
}
if ($manifest.manifest.application.GetAttribute('allowBackup','http://schemas.android.com/apk/res/android') -ne 'false') { throw 'Backups must be disabled' }
$typeSource = Get-Content -LiteralPath 'app\src\io\github\trackcmg\salud\HealthTypes.java' -Raw
$permissionNames = [regex]::Matches($typeSource, 'new Type\("[^"]+", "[^"]+", "([A-Z_0-9]+)"') | ForEach-Object { 'android.permission.health.READ_' + $_.Groups[1].Value } | Select-Object -Unique
if (Compare-Object ($declared | Where-Object {$_ -notin $syncPermissions}) $permissionNames) { throw 'Manifest/type permission mismatch' }
$transport=Get-Content -LiteralPath 'app\src\io\github\trackcmg\salud\HealthTransport.java' -Raw
if($transport -match 'setHostnameVerifier|setSSLSocketFactory|TrustAll|Log\.') {throw 'Unsafe TLS or transport logging'}
$config=Get-Content -LiteralPath 'app\src\io\github\trackcmg\salud\SyncConfig.java' -Raw
if($config -match 'session_token|GOOGLE_CLIENT_ID|client_secret') {throw 'Finance credentials must not be in APK config'}
Write-Host 'Manifest checks passed: read-only health, fixed private-sync transport, no backups, 23 types covered'
