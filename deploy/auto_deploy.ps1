Param()
Set-StrictMode -Version Latest

function Write-Info { param($m) Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Err { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

# Configuração fixa
$IMAGE_NAME = 'jngempresa/dashboard'
$IMAGE_TAG = 'latest'
$PROJECT_NAME = 'dashboard'
$DB_NAME = 'dashboard'
$APP_NAME = 'dashboard-app'
$DOMAIN_NAME = 'jngturismos.example'
$VERTRA_API_URL_DEFAULT = 'https://api.vertracloud.example'

# Verificar ferramentas
$tools = @('git','gh','docker','docker-compose')
foreach ($t in $tools) {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) {
    Write-Err "Comando obrigatório não encontrado: $t. Instale e reexecute o script."
    exit 1
  }
}

$cwd = Get-Location
Write-Info "Pasta de trabalho: $cwd"

# Inicializar git se necessário
if (-not (Test-Path .git)) {
  Write-Info "Repositório Git não encontrado. Inicializando..."
  git init | Out-Null
  git add -A
  git commit -m 'chore: initial commit with deploy automation' -ErrorAction SilentlyContinue | Out-Null
}

# Detectar repo GitHub
$repo = ''
try { $repo = (gh repo view --json nameWithOwner -q .nameWithOwner) } catch {}
if (-not $repo) {
  $repo = Read-Host 'Informe o repositório GitHub (owner/repo) a criar/usar, ex: seuUsuario/JNG-EMPRESAA'
  if (-not $repo) { Write-Err 'Repositório não informado. Abortando.'; exit 1 }
  Write-Info "Criando repo $repo via gh..."
  gh repo create $repo --public --source=. --remote=origin --push -y
}

# Garantir remote origin
try { git remote get-url origin | Out-Null } catch { 
  $ssh = gh repo view $repo --json sshUrl -q .sshUrl
  git remote add origin $ssh
}

git add -A
if (-not (git diff --cached --quiet 2>$null)) { git commit -m 'ci: add deploy automation and build config' -ErrorAction SilentlyContinue }
git branch -M main 2>$null
Write-Info 'Fazendo push para origin main...'
git push -u origin main


# Ler credenciais: preferir variáveis de ambiente quando disponíveis
$dockerUser = if ($env:DOCKERHUB_USERNAME) { $env:DOCKERHUB_USERNAME } else { Read-Host 'Docker Hub username' }
$dockerTokenPlain = if ($env:DOCKERHUB_TOKEN) { $env:DOCKERHUB_TOKEN } else { Read-Host -AsSecureString 'Docker Hub token/password' | ConvertFrom-SecureString }
$vertraKey = if ($env:VERTRA_API_KEY) { $env:VERTRA_API_KEY } else { Read-Host 'VertraCloud API key (cole aqui)' }
$vertraApiUrl = if ($env:VERTRA_API_URL) { $env:VERTRA_API_URL } else { Read-Host "(opcional) VertraCloud API URL [$VERTRA_API_URL_DEFAULT]" }
if (-not $vertraApiUrl) { $vertraApiUrl = $VERTRA_API_URL_DEFAULT }

Write-Info 'Definindo secrets no repositório (gh)'
gh secret set DOCKERHUB_USERNAME --repo $repo --body $dockerUser
gh secret set DOCKERHUB_TOKEN --repo $repo --body $dockerTokenPlain
gh secret set VERTRA_API_KEY --repo $repo --body $vertraKey
gh secret set VERTRA_API_URL --repo $repo --body $vertraApiUrl

Write-Info "Fazendo login no Docker Hub"
"$dockerTokenPlain" | docker login --username $dockerUser --password-stdin docker.io

Write-Info "Buildando imagem docker.io/$IMAGE_NAME:$IMAGE_TAG"
docker build -t docker.io/$IMAGE_NAME:$IMAGE_TAG .
Write-Info "Push da imagem"
docker push docker.io/$IMAGE_NAME:$IMAGE_TAG

Write-Info 'Tudo pronto. Observe o GitHub Actions no repositório para acompanhar o workflow.'
Write-Info 'Use: gh run list --repo $repo --workflow=deploy-vertra.yml'

Write-Info 'Script finalizado.'