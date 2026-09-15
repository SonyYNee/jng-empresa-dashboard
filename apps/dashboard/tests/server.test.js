import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

test('cadastro, proteção, login, persistência e logout', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'jng-test-')), 'test.sqlite');
  process.env.SETUP_TOKEN = 'integration-test-token';
  const { server } = await import('../src/server.js');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = origin;
  const post = (path, body, cookie = '') =>
    fetch(origin + path, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(origin + '/api/overview')).status, 401);
    const data = {
      name: 'Teste',
      email: 'teste@example.com',
      password: 'Ab12',
      token: process.env.SETUP_TOKEN,
    };
    assert.equal((await post('/api/setup', { ...data, token: 'wrong' })).status, 403);
    const signup = await post('/api/setup', data);
    assert.equal(signup.status, 200);
    assert.match(signup.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await post('/api/setup', data)).status, 403);
    assert.equal((await post('/api/login', { ...data, password: 'errada' })).status, 401);
    const login = await post('/api/login', data);
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(origin + '/api/social')).status, 401);
    assert.equal(
      (await post('/api/social', { instagram: 'javascript:alert(1)' }, cookie)).status,
      400,
    );
    assert.equal((await post('/api/social', { whatsapp: '123' }, cookie)).status, 400);
    assert.equal(
      (
        await post(
          '/api/social',
          { instagram: 'https://www.instagram.com/jng', whatsapp: '+55 51 99999-9999' },
          cookie,
        )
      ).status,
      200,
    );
    const channels = await (await fetch(origin + '/api/public/social')).json();
    assert.equal(channels.social.instagram, 'https://www.instagram.com/jng');
    assert.equal(channels.social.whatsapp, '5551999999999');
    assert.equal((await post('/api/social', { instagram: '' }, cookie)).status, 200);
    assert.deepEqual((await (await fetch(origin + '/api/public/social')).json()).social, {});
    const overview = await (
      await fetch(origin + '/api/overview', { headers: { Cookie: cookie } })
    ).json();
    assert.equal(overview.accesses, 2);
    assert.equal(overview.user.name, 'Teste');
    assert.equal(overview.user.password, undefined);
    assert.equal((await fetch(origin + '/api/users')).status, 401);
    const newUser = {
      name: 'Nova Motorista',
      email: 'nova@example.com',
      password: 'Cd34',
      role: 'driver',
    };
    assert.equal((await post('/api/users', newUser)).status, 401);
    assert.equal((await post('/api/users', { ...newUser, role: '__proto__' }, cookie)).status, 400);
    assert.equal((await post('/api/users', { ...newUser, password: '123' }, cookie)).status, 400);
    const createdResponse = await post('/api/users', newUser, cookie);
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(
      (await post('/api/users', { ...newUser, email: 'NOVA@example.com' }, cookie)).status,
      409,
    );
    const members = await (
      await fetch(origin + '/api/users', { headers: { Cookie: cookie } })
    ).json();
    assert.equal(members.users.length, 2);
    assert.equal(members.users[0].password, undefined);
    const employeeLogin = await post('/api/login', newUser);
    assert.equal(employeeLogin.status, 200);
    const employeeCookie = employeeLogin.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (await post('/api/social', { instagram: 'https://example.com' }, employeeCookie)).status,
      403,
    );
    assert.equal(
      (await fetch(origin + '/api/users', { headers: { Cookie: employeeCookie } })).status,
      403,
    );
    assert.equal(
      (await post('/api/users', { ...newUser, email: 'other@example.com' }, employeeCookie)).status,
      403,
    );
    assert.equal(
      (await post('/api/users/role', { id: created.id, role: 'owner' }, employeeCookie)).status,
      403,
    );
    assert.equal(
      (await post('/api/users/role', { id: overview.user.id, role: 'member' }, cookie)).status,
      409,
    );
    assert.equal(
      (await post('/api/users/role', { id: 99999, role: 'member' }, cookie)).status,
      404,
    );
    assert.equal(
      (await post('/api/users/role', { id: created.id, role: 'manager' }, cookie)).status,
      200,
    );
    assert.equal(
      (await fetch(origin + '/api/users', { headers: { Cookie: employeeCookie } })).status,
      403,
    );
    assert.equal(
      (await post('/api/users/role', { id: created.id, role: 'owner' }, cookie)).status,
      200,
    );
    assert.equal(
      (await fetch(origin + '/api/users', { headers: { Cookie: employeeCookie } })).status,
      200,
    );
    assert.equal(
      (await post('/api/users/role', { id: overview.user.id, role: 'member' }, employeeCookie))
        .status,
      200,
    );
    assert.equal((await post('/api/users', newUser, cookie)).status, 403);
    assert.equal(
      (await post('/api/users/role', { id: created.id, role: 'driver' }, employeeCookie)).status,
      409,
    );
    assert.equal(
      (await post('/api/users/role', { id: overview.user.id, role: 'owner' }, employeeCookie))
        .status,
      200,
    );
    assert.equal(
      (await post('/api/users/role', { id: created.id, role: 'driver' }, cookie)).status,
      200,
    );
    assert.equal(
      (await fetch(origin + '/api/users', { headers: { Cookie: employeeCookie } })).status,
      403,
    );
    assert.equal(overview.user.role, 'owner');
    assert.equal(overview.activity[0].name, 'Teste');
    assert.equal(overview.activity[0].role, 'owner');
    assert.equal((await post('/api/profile', { name: 'Intruso' })).status, 401);
    const profile = { name: 'João Silva', email: data.email };
    assert.equal((await post('/api/profile', { ...profile, role: 'owner' }, cookie)).status, 403);
    assert.equal(
      (
        await post(
          '/api/profile',
          { ...profile, email: 'novo@example.com', currentPassword: 'errada' },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          '/api/profile',
          { ...profile, photo: 'data:image/svg+xml;base64,PHN2Zz4=' },
          cookie,
        )
      ).status,
      400,
    );
    const photo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    assert.equal((await post('/api/profile', { ...profile, photo }, cookie)).status, 200);
    const updated = await (
      await fetch(origin + '/api/overview', { headers: { Cookie: cookie } })
    ).json();
    assert.equal(updated.user.name, profile.name);
    assert.equal(updated.activity.find((item) => item.user_id === overview.user.id).photo, photo);
    assert.equal(
      updated.activity.find((item) => item.user_id === overview.user.id).name,
      profile.name,
    );
    const database = new DatabaseSync(process.env.DATABASE_PATH);
    const saved = database.prepare('SELECT * FROM users LIMIT 1').get();
    assert.equal(saved.photo, photo);
    database
      .prepare(
        "INSERT INTO users(name,email,password,role) VALUES ('Motorista Teste','motorista@example.com',?,'driver')",
      )
      .run(saved.password);
    const driverLogin = await post('/api/login', {
      email: 'motorista@example.com',
      password: data.password,
    });
    const driverCookie = driverLogin.headers.get('set-cookie').split(';')[0];
    const driverView = await (
      await fetch(origin + '/api/overview', { headers: { Cookie: driverCookie } })
    ).json();
    assert.equal(driverView.teamView, false);
    assert.equal(driverView.activity.length, 1);
    assert.equal(driverView.activity[0].role, 'driver');
    const teamView = await (
      await fetch(origin + '/api/overview', { headers: { Cookie: cookie } })
    ).json();
    assert.equal(teamView.activity.length, 4);
    assert.equal(
      (
        await post(
          '/api/profile',
          { ...profile, email: 'motorista@example.com', currentPassword: data.password },
          cookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await post(
          '/api/profile',
          { ...profile, email: 'novo@example.com', currentPassword: data.password, photo: null },
          cookie,
        )
      ).status,
      200,
    );
    assert.equal(database.prepare('SELECT photo FROM users WHERE id=?').get(saved.id).photo, null);
    assert.equal((await post('/api/login', data)).status, 401);
    const secondLogin = await post('/api/login', {
      email: 'novo@example.com',
      password: data.password,
    });
    const secondCookie = secondLogin.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (
        await post(
          '/api/password',
          {
            currentPassword: 'errada',
            password: 'Ef56',
            confirmPassword: 'Ef56',
          },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          '/api/password',
          {
            currentPassword: data.password,
            password: 'Ef56',
            confirmPassword: 'diferente',
          },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          '/api/password',
          {
            currentPassword: data.password,
            password: 'Ef56',
            confirmPassword: 'Ef56',
          },
          cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await fetch(origin + '/api/overview', { headers: { Cookie: secondCookie } })).status,
      401,
    );
    assert.equal(
      (await post('/api/login', { email: 'novo@example.com', password: data.password })).status,
      401,
    );
    assert.equal(
      (await post('/api/login', { email: 'novo@example.com', password: 'Ef56' })).status,
      200,
    );
    database.close();
    assert.equal(
      (
        await fetch(origin + '/api/logout', {
          method: 'POST',
          headers: { Origin: 'https://evil.example', Cookie: cookie },
        })
      ).status,
      403,
    );
    assert.equal((await post('/api/logout', {}, cookie)).status, 200);
    assert.equal(
      (await fetch(origin + '/api/overview', { headers: { Cookie: cookie } })).status,
      401,
    );
    for (const path of ['/login', '/visao-geral', '/configuracoes', '/style.css', '/app.js'])
      assert.equal((await fetch(origin + path)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
