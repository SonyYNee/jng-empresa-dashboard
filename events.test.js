import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initEvents} from './events.js';
test('eventos: permissões, validação, publicação, edição e exclusão',async()=>{
 const db=new DatabaseSync(':memory:');let user={role:'owner'},input={},result;
 const handler=initEvents(db,{session:()=>user,body:async()=>input,json:(_,status,data)=>result={status,...data},validPhoto:photo=>photo==='test-photo'});
 const call=async(method,path,data={})=>{input=data;await handler({method},{},path);return result;};
 try{
  user=null;assert.equal((await call('GET','/api/events')).status,401);
  user={role:'driver'};assert.equal((await call('POST','/api/events')).status,403);
  user={role:'manager'};
  const event={title:'Evento teste',city:'Osório',venue:'Centro',date:'2027-01-01T10:00',endDate:'2027-01-01T20:00',status:'available',included:'Transporte\nGuia',price:'48.32',seatsAvailable:'12',published:false};
  assert.equal((await call('POST','/api/events',{...event,endDate:'2026-01-01T10:00'})).status,400);
  assert.equal((await call('POST','/api/events',{...event,price:-1})).status,400);
  const {id}=await call('POST','/api/events',event);assert.ok(id);
  db.exec("CREATE TABLE vehicles(id INTEGER PRIMARY KEY,model TEXT); INSERT INTO vehicles VALUES(1,'Sprinter');");
  assert.equal((await call('POST','/api/events',{...event,id,photos:Array(16).fill('test-photo')})).status,200);
  assert.equal((await call('POST','/api/events',{...event,id,photos:['invalid']})).status,400);
  assert.equal((await call('POST','/api/events',{...event,id,photos:Array(15).fill('test-photo'),vehicle_id:1})).status,200);
  const gallery=(await call('GET','/api/events')).events[0];assert.equal(gallery.photos.length,15);assert.equal(gallery.vehicle_id,1);assert.equal(gallery.vehicle,'Sprinter');
  assert.equal((await call('POST','/api/events',{...event,id,vehicle_id:99})).status,400);
  db.exec("CREATE TABLE transport_routes(id INTEGER PRIMARY KEY,type TEXT,origin TEXT,destination TEXT,stops TEXT,maps_url TEXT); INSERT INTO transport_routes VALUES(1,'event','Origem','Destino','[{\"name\":\"Parada\",\"time\":\"09:00\",\"notes\":\"interno\"}]','https://www.google.com/maps');");
  assert.equal((await call('POST','/api/events',{...event,id,route_id:1})).status,200);
  const linked=(await call('GET','/api/events')).events[0];assert.equal(linked.destination,'Destino');assert.deepEqual(linked.stops,[{name:'Parada',time:'09:00'}]);
  db.exec("UPDATE transport_routes SET type='private'");
  assert.equal((await call('POST','/api/events',{...event,id,route_id:1})).status,400);
  assert.equal((await call('GET','/api/public/events')).events.length,0);
  assert.equal((await call('POST','/api/events',{...event,id,published:true})).status,200);
  const published=(await call('GET','/api/public/events')).events[0];assert.equal(published.slug,`evento-${id}`);assert.equal(published.price,48.32);assert.deepEqual(published.included,['Transporte','Guia']);
  assert.equal((await call('POST','/api/events/delete',{id,confirmTitle:'errado'})).status,400);
  assert.equal((await call('POST','/api/events/delete',{id,confirmTitle:event.title})).status,200);
  assert.equal((await call('GET','/api/events')).events.length,0);
 }finally{db.close();}
});
