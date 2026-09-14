import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRouteDistance,extractRouteCoordinates } from './route-distance.js';
test('cálculo gratuito usa pontos do link, preserva ordem e converte metros',async()=>{
 const maps_url='https://www.google.com/maps/dir/A/B/C/data=!1d-50.28!2d-29.89!1d-50.27!2d-29.88!1d-50.26!2d-29.87';
 assert.deepEqual(extractRouteCoordinates(maps_url),[[-50.28,-29.89],[-50.27,-29.88],[-50.26,-29.87]]);
 let calls=0;const request=async url=>{calls++;assert.ok(url.includes('-50.28,-29.89;-50.27,-29.88;-50.26,-29.87'));return new Response(JSON.stringify({code:'Ok',routes:[{distance:12345}]}));};
 assert.equal((await calculateRouteDistance({maps_url},{request})).distance,12.35);
 await calculateRouteDistance({maps_url},{request});assert.equal(calls,1);
 await assert.rejects(calculateRouteDistance({maps_url:'https://www.google.com/maps/dir/A/B/'}),/pontos/);
});
