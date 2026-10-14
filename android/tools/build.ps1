$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDir
$jdkDir = (Get-ChildItem -LiteralPath '.tools\jdk' -Directory | Select-Object -First 1).FullName
$androidJar = (Get-ChildItem -LiteralPath '.tools\platform' -Recurse -Filter android.jar | Select-Object -First 1).FullName
$aapt2 = (Get-ChildItem -LiteralPath '.tools\build-tools' -Recurse -Filter aapt2.exe | Select-Object -First 1).FullName
$buildTools = Split-Path -Parent $aapt2
$java = Join-Path $jdkDir 'bin\java.exe'
$javac = Join-Path $jdkDir 'bin\javac.exe'
$jar = Join-Path $jdkDir 'bin\jar.exe'
$keytool = Join-Path $jdkDir 'bin\keytool.exe'
if (!$jdkDir -or !$androidJar -or !$aapt2) { throw 'Run tools\bootstrap.ps1 first.' }
function Check-Exit([string] $operation) {
    if ($LASTEXITCODE -ne 0) { throw ($operation + ' failed: ' + $LASTEXITCODE) }
}

# A unique directory prevents old classes or resources leaking into a later APK.
$buildDir = Join-Path $projectDir ('build\' + [guid]::NewGuid().ToString('N'))
$classesDir = Join-Path $buildDir 'classes'
$dexDir = Join-Path $buildDir 'dex'
$distDir = Join-Path $projectDir 'dist'
$signDir = Join-Path $projectDir '.signing'
New-Item -ItemType Directory -Path $classesDir,$dexDir,$distDir,$signDir -Force | Out-Null
$sourceFiles = Get-ChildItem -LiteralPath 'app\src' -Recurse -Filter *.java | ForEach-Object FullName
& $javac -encoding UTF-8 -source 17 -target 17 -classpath $androidJar -d $classesDir @sourceFiles
Check-Exit 'Java compilation'
& $jar --create --file (Join-Path $buildDir 'classes.jar') -C $classesDir .
Check-Exit 'Class packaging'
& $java -cp (Join-Path $buildTools 'lib\d8.jar') com.android.tools.r8.D8 --min-api 34 --lib $androidJar --output $dexDir (Join-Path $buildDir 'classes.jar')
Check-Exit 'DEX compilation'
& $aapt2 compile --dir 'app\res' -o (Join-Path $buildDir 'resources.zip')
Check-Exit 'Resource compilation'
& $aapt2 link -o (Join-Path $buildDir 'unsigned.apk') -I $androidJar --manifest 'app\AndroidManifest.xml' (Join-Path $buildDir 'resources.zip')
Check-Exit 'APK resource linking'
Push-Location -LiteralPath $dexDir
try { & $jar --update --file (Join-Path $buildDir 'unsigned.apk') classes.dex; Check-Exit 'DEX packaging' }
finally { Pop-Location }

# Personal, locally signed build. Preserve this key for compatible future updates.
# Never commit .signing or publish the key/password file.
$keystore = Join-Path $signDir 'trackcmg-salud.p12'
$passwordFile = Join-Path $signDir 'keystore-password.txt'
if (!(Test-Path -LiteralPath $keystore)) {
    if (!(Test-Path -LiteralPath $passwordFile)) {
        $passwordBytes = New-Object byte[] 32
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($passwordBytes)
        $password = [Convert]::ToBase64String($passwordBytes)
        # Generated local signing material, not application source.
        [IO.File]::WriteAllText($passwordFile, $password, [Text.UTF8Encoding]::new($false))
    }
    & $keytool -genkeypair -keystore $keystore -storetype PKCS12 -storepass:file $passwordFile -keypass:file $passwordFile -alias trackcmg-salud -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=TrackCMG Salud Personal'
    Check-Exit 'Personal signing key generation'
}
& (Join-Path $buildTools 'zipalign.exe') -f -p 4 (Join-Path $buildDir 'unsigned.apk') (Join-Path $buildDir 'aligned.apk')
Check-Exit 'APK alignment'
$apk = Join-Path $distDir 'TrackCMG-Salud-0.2.0.apk'
& $java -jar (Join-Path $buildTools 'lib\apksigner.jar') sign --ks $keystore --ks-pass ('file:' + $passwordFile) --out $apk (Join-Path $buildDir 'aligned.apk')
Check-Exit 'APK signing'
& $java -jar (Join-Path $buildTools 'lib\apksigner.jar') verify --verbose $apk
Check-Exit 'Signature verification'
& $aapt2 dump badging $apk
Check-Exit 'Package verification'
Get-FileHash -LiteralPath $apk -Algorithm SHA256 | Select-Object Path,Hash
Write-Host ('APK created: ' + $apk)
