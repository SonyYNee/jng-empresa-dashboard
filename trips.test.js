import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initTrips,projectTrip} from './trips.js';
test('pacotes recorrentes: cadastro, publicacao, proxima saida e exclusao',async()=>{
 const db=new DatabaseSync(':memory:');let input,result,user={role:'owner'};
 const handler=initTrips(db,{session:()=>user,body:async()=>input,json:(_,status,data)=>result={status,...data},validPhoto:()=>false});
 const call=async(method,path,data={})=>{input=data;await handler({method},{},path);return result;};
 const trip={title:'Fim de semana',city:'Santa Maria',venue:'Centro',date:'2026-09-19T08:00',endDate:'2026-09-19T20:00',frequency:'weekly',weekdays:[6,0],program:'08h embarque\nVisita e retorno',notIncluded:'Almoço',included:'Transporte\nGuia',status:'available',published:false};
 try{
  assert.equal((await call('POST','/api/trips',{...trip,weekdays:[]})).status,400);
  const {id}=await call('POST','/api/trips',trip);assert.ok(id);
  assert.equal((await call('GET','/api/public/trips')).trips.length,0);
  db.exec("CREATE TABLE transport_routes(id INTEGER PRIMARY KEY,type TEXT,origin TEXT,destination TEXT,stops TEXT,maps_url TEXT); INSERT INTO transport_routes VALUES(1,'private','Origem','Destino','[]','https://www.google.com/maps');");
  await call('POST','/api/trips',{...trip,id,published:true,route_id:1});
  const published=(await call('GET','/api/public/trips')).trips[0];assert.equal(published.destination,'Santa Maria');assert.equal(published.slug,`viagem-${id}`);
  const next=projectTrip(db.prepare('SELECT * FROM company_trips WHERE id=?').get(id),new Date('2026-09-21T12:00:00-03:00'));assert.equal(next.departureDate,'2026-09-26');assert.equal(next.returnDate,'2026-09-26');
  user={role:'driver'};assert.equal((await call('POST','/api/trips',trip)).status,403);user={role:'owner'};
  assert.equal((await call('POST','/api/trips/delete',{id,confirmTitle:trip.title})).status,200);
  assert.equal((await call('GET','/api/trips')).trips.length,0);
 }finally{db.close();}
});
