"""Preserva fontes locais em arquivo privado; nunca publica credenciais."""

import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import zipfile
from datetime import datetime, timezone


root = Path(__file__).resolve().parents[2]
private = root / 'cerebro' / 'privado'
inventory = root / 'cerebro' / 'inventario'
private.mkdir(parents=True, exist_ok=True)
inventory.mkdir(parents=True, exist_ok=True)
stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
archive_path = private / f'JNG-BACKUP-COMPLETO-{stamp}.zip'
manifest = {'captured_at_utc': stamp, 'files': [], 'sessions': [], 'limitations': []}


def git(*args):
  return subprocess.check_output(['git', *args], cwd=root, text=True, encoding='utf-8')


def digest(content):
  return hashlib.sha256(content).hexdigest()


def archive_bytes(archive, name, content):
  archive.writestr(name, content)
  manifest['files'].append({'path': name, 'bytes': len(content), 'sha256': digest(content)})


def image_values(value):
  if isinstance(value, dict):
    for item in value.values():
      yield from image_values(item)
  elif isinstance(value, list):
    for item in value:
      yield from image_values(item)
  elif isinstance(value, str) and value.startswith('data:image/') and ';base64,' in value:
    yield value


bundle = private / 'repositorio.bundle'
subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=root, check=True)
subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=root, check=True, capture_output=True)
database = root / 'data' / 'dashboard.sqlite'
sqlite_backup = private / 'dashboard-local-consistente.sqlite'
if database.exists():
  with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as source:
    with sqlite3.connect(sqlite_backup) as target:
      source.backup(target)
      if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise RuntimeError('Falha na integridade do backup SQLite.')

tracked = git('ls-files', '-z').split('\0')
manifest['code_commit'] = git('rev-parse', 'HEAD').strip()
extracted_images = set()

with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
  # Inclui o workspace, mas exclui dependências reconstruíveis, Git bruto e o próprio backup.
  for directory, children, files in os.walk(root):
    current = Path(directory)
    children[:] = [name for name in children if name not in {'.git', 'node_modules'}
      and current / name != private]
    for name in files:
      path = current / name
      if path.parent == root / 'data' and path.name.startswith('dashboard.sqlite'):
        continue
      if path.is_symlink():
        manifest['limitations'].append(f'Symlink não copiado: {path.relative_to(root)}')
        continue
      archive_bytes(archive, 'workspace/' + path.relative_to(root).as_posix(), path.read_bytes())
  archive_bytes(archive, 'recuperacao/repositorio.bundle', bundle.read_bytes())
  if sqlite_backup.exists():
    archive_bytes(archive, 'workspace/data/dashboard.sqlite', sqlite_backup.read_bytes())
  # Snapshots remotos e notas privadas também entram no pacote final.
  for path in private.rglob('*'):
    if path.is_file() and path not in {archive_path, bundle, sqlite_backup} and not path.name.startswith('JNG-BACKUP-COMPLETO-'):
      archive_bytes(archive, 'privado/' + path.relative_to(private).as_posix(), path.read_bytes())

  for path in (Path.home() / '.codex' / 'sessions').rglob('*.jsonl'):
    try:
      with path.open(encoding='utf-8') as stream:
        first = json.loads(stream.readline())
      if 'JNG EMPRESAA' not in str(first.get('payload', {}).get('cwd', '')).upper():
        continue
      content = path.read_bytes()
      archive_bytes(archive, 'historico/bruto/' + path.name, content)
      transcript = []
      messages = 0
      incomplete = 0
      for line in content.splitlines():
        try:
          record = json.loads(line)
        except ValueError:
          incomplete += 1
          continue
        payload = record.get('payload', {})
        if record.get('type') == 'response_item' and payload.get('type') == 'message':
          role = payload.get('role', '')
          if role in {'user', 'assistant'}:
            texts = [part.get('text', '') for part in payload.get('content', []) if isinstance(part, dict) and part.get('text')]
            if texts:
              transcript.append(f"## {record.get('timestamp', '')} — {role}\n\n" + '\n\n'.join(texts))
              messages += 1
        for value in image_values(payload):
          header, encoded = value.split(';base64,', 1)
          try:
            image = base64.b64decode(encoded, validate=True)
          except ValueError:
            continue
          image_hash = digest(image)
          if image_hash not in extracted_images:
            extension = header.split('/')[-1].replace('jpeg', 'jpg')
            if extension not in {'png', 'jpg', 'webp', 'gif'}:
              continue
            archive_bytes(archive, f'historico/imagens/{image_hash}.{extension}', image)
            extracted_images.add(image_hash)
      archive_bytes(archive, 'historico/conversas/' + path.stem + '.md', '\n\n'.join(transcript).encode())
      manifest['sessions'].append({'id': first.get('payload', {}).get('id'), 'file': path.name,
        'bytes': len(content), 'messages': messages, 'incomplete_lines': incomplete})
    except (OSError, ValueError) as error:
      manifest['limitations'].append(f'{path.name}: {type(error).__name__}')

  # Os anexos locais encontrados pertencem ao contexto disponível nesta captura.
  attachments = Path.home() / '.codex' / 'attachments'
  if attachments.exists():
    for path in attachments.rglob('*'):
      if path.is_file():
        archive_bytes(archive, 'historico/anexos/' + path.relative_to(attachments).as_posix(), path.read_bytes())
  memories = Path.home() / '.codex' / 'memories'
  for name in ['MEMORY.md', 'memory_summary.md']:
    path = memories / name
    if path.exists():
      archive_bytes(archive, 'historico/memoria-anterior/' + name, path.read_bytes())
  archive.writestr('MANIFESTO-PRIVADO.json', json.dumps(manifest, ensure_ascii=False, indent=2))

with zipfile.ZipFile(archive_path) as archive:
  invalid = archive.testzip()
  if invalid:
    raise RuntimeError('Entrada ZIP inválida: ' + invalid)
  for entry in manifest['files']:
    if digest(archive.read(entry['path'])) != entry['sha256']:
      raise RuntimeError('Hash inválido: ' + entry['path'])

checksum = digest(archive_path.read_bytes())
archive_path.with_suffix('.sha256').write_text(checksum + '  ' + archive_path.name + '\n', encoding='utf-8')
summary = {
  'captured_at_utc': stamp,
  'code_commit': manifest['code_commit'],
  'private_archive': 'cerebro/privado/' + archive_path.name,
  'archive_bytes': archive_path.stat().st_size,
  'sha256': checksum,
  'files_verified': len(manifest['files']),
  'sessions': manifest['sessions'],
  'embedded_images_extracted': len(extracted_images),
  'limitations': manifest['limitations'],
  'excluded_rebuildable': ['node_modules', '.git (substituído por bundle)'],
  'off_device_copy': False,
}
(inventory / 'backup-verificado.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, ensure_ascii=True))
