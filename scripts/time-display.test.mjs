import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatTime,getTimeFormat,setTimeFormat} from '../src/lib/timeDisplay.ts';
test('12-hour display distinguishes midnight, noon and afternoon without modifying source values',()=>{
 assert.equal(formatTime('00:00','12'),'12:00 AM');
 assert.equal(formatTime('12:00','12'),'12:00 PM');
 assert.equal(formatTime('14:30','12'),'2:30 PM');
 assert.equal(formatTime('09:05','12'),'9:05 AM');
 assert.equal(formatTime('2:30 PM','24'),'14:30');
 assert.equal(formatTime('12:00 AM','24'),'00:00');
 assert.equal(formatTime('12:00 PM','24'),'12:00');
 assert.equal(formatTime('','12'),'');
 assert.equal(formatTime('25:30','12'),'25:30');
});
test('display preference defaults to US time and cannot leak between signed-in accounts',()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 globalThis.window={dispatchEvent:()=>{}};
 localStorage.setItem('authUser',JSON.stringify({email:'one@example.invalid'}));
 assert.equal(getTimeFormat(),'12');setTimeFormat('24');assert.equal(getTimeFormat(),'24');
 localStorage.setItem('authUser',JSON.stringify({email:'two@example.invalid'}));assert.equal(getTimeFormat(),'12');
 localStorage.setItem('authUser',JSON.stringify({email:'one@example.invalid'}));assert.equal(getTimeFormat(),'24');
 delete globalThis.localStorage;delete globalThis.window;
});
