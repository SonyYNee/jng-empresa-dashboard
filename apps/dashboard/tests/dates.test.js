import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Executa a função da interface sem inicializar o DOM nem fazer requisições.
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function date(value) {');
const end = source.indexOf('\nconst avatar', start);
const formatDate = vm.runInNewContext(`(${source.slice(start, end)})`, { Date, Intl });

test('datas da dashboard aceitam SQLite e PostgreSQL sem duplicar o fuso', () => {
  const expected = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date('2026-09-15T18:30:00.000Z'));
  for (const value of [
    '2026-09-15 18:30:00',
    '2026-09-15T18:30:00.000Z',
    '2026-09-15T15:30:00-03:00',
  ]) {
    assert.equal(formatDate(value), expected);
  }
  for (const value of [null, undefined, '', 'data inválida']) {
    assert.equal(formatDate(value), 'Data indisponível');
  }
});
