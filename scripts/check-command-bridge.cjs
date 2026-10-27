'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() { this.style = {}; this.listeners = {}; this.value = ''; }
  setAttribute() {}
  appendChild(child) { (this.children ||= []).push(child); }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  fire(name, data = {}) {
    const e = {preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...data};
    for (const fn of this.listeners[name] || []) fn(e);
    return e;
  }
}
const body = new Element();
let next;
const canvas = {getBoundingClientRect: () => ({left: 10, top: 20, width: 400, height: 800})};
const window = {dispatchEvent() {}, requestAnimationFrame: fn => { next = fn; }};
const document = {body, createElement: () => new Element(), getElementById: () => canvas};
const script = fs.readFileSync('app/src/main/assets/bridge/commands.js', 'utf8');
vm.runInNewContext(script, {window, document, Event: class {}});
const [form, clear] = body.children;
const [input] = form.children;
assert.equal(form.style.display, 'none');
assert.equal(clear.disabled, true);
window.__cadcraftCommandState = JSON.stringify({rect: [20, 300, 100, 24], width: 200, height: 400, buffer: 'line'});
next();
assert.equal(form.style.left, '50px');
assert.equal(form.style.top, '620px');
assert.equal(input.value, 'line');
input.fire('focus');
input.value = 'círculo';
input.fire('compositionstart');
input.fire('input');
assert.equal(window.__cadcraftCommandDraft, undefined);
assert.equal(input.fire('keydown', {key: 'Enter', isComposing: true}).prevented, true);
form.fire('submit');
assert.equal(window.__cadcraftCommandRequest, undefined);
input.fire('compositionend');
assert.equal(window.__cadcraftCommandDraft, 'círculo');
form.fire('submit');
assert.deepEqual(JSON.parse(window.__cadcraftCommandRequest), {action: 'submit', text: 'círculo'});
assert.equal(input.value, '');
input.value = '10,20';
form.fire('submit');
assert.equal(input.value, '10,20', 'busy bridge preserves the next input');
window.__cadcraftCommandRequest = null;
input.fire('blur');
next();
assert.equal(input.value, '10,20', 'keyboard dismissal preserves draft');
clear.fire('click');
assert.equal(JSON.parse(window.__cadcraftCommandRequest).action, 'deselect');
assert.equal(input.fire('keydown', {key: 'a'}).stopped, true);
assert.equal(input.fire('input').stopped, true);
window.__cadcraftCommandState = JSON.stringify({rect: null});
next();
assert.equal(form.style.display, 'none');
vm.runInNewContext(script, {window, document, Event: class {}});
assert.equal(body.children.length, 2, 'installation is idempotent');
console.log('Command bridge: 18 assertions passed');
