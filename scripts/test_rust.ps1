# Invocable desde npm aunque rustup no esté en PATH en la sesión de escritorio.
$ErrorActionPreference = "Stop"
$cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
$cargoPath = if ($cargoCommand) { $cargoCommand.Source } else {
    Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
}
if (-not (Test-Path -LiteralPath $cargoPath)) {
    throw "Cargo no encontrado. Instala Rust mediante rustup."
}
& $cargoPath test --manifest-path "$PSScriptRoot\..\src-tauri\Cargo.toml" @args
exit $LASTEXITCODE
