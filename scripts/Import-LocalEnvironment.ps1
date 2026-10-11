[CmdletBinding()]
param(
    [string]$Path
)

if (-not $Path) {
    $Path = Join-Path $PSScriptRoot '..\.secrets\credentials.env'
}

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw 'No existe el archivo local de credenciales. Copia .env.example a .secrets/credentials.env.'
}

# Validar antes de modificar el entorno. Nunca mostrar contenidos del archivo.
$entries = @{}
$lineNumber = 0
foreach ($line in [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Path).Path)) {
    $lineNumber++
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) {
        continue
    }
    if ($trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        throw "Formato invalido en la linea $lineNumber. Usa NOMBRE=valor."
    }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2) {
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }
    if ($value.Length -gt 0) {
        $entries[$name] = $value
    }
}

if ($entries.ContainsKey('AWS_PROFILE') -and
    ($entries.ContainsKey('AWS_ACCESS_KEY_ID') -or $entries.ContainsKey('AWS_SECRET_ACCESS_KEY'))) {
    throw 'Configura AWS_PROFILE o claves AWS, pero no ambos metodos en el archivo local.'
}

foreach ($entry in $entries.GetEnumerator()) {
    [System.Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
}

Write-Host ("Variables locales cargadas: {0}. Valores ocultos." -f $entries.Count)

# Al usar dot-source, evitar dejar copias de secretos en variables auxiliares.
Remove-Variable entries, entry, line, trimmed, value, name, lineNumber, Matches -ErrorAction SilentlyContinue
