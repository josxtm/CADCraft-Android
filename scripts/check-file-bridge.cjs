const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app/src/main/assets/bridge/files.js', 'utf8');

async function main() {
    const events = {}, clicks = {}, saves = [], reports = [], urls = [];
    let nativeAccepts = true, readFails = false, aborts = false, fetchFails = false, oversized = false;
    class Anchor { click() { this.browserClicks = (this.browserClicks || 0) + 1; } }
    class Reader {
        readAsDataURL(blob) {
            Promise.resolve().then(async () => {
                if (readFails) return this.onerror();
                if (aborts) return this.onabort();
                this.result = 'data:' + blob.type + ';base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64');
                this.onload();
            });
        }
    }
    const window = {addEventListener(name, handler) { events[name] = handler; }};
    const document = {addEventListener(name, handler) { clicks[name] = handler; }};
    const context = vm.createContext({window, document, HTMLAnchorElement: Anchor, FileReader: Reader,
        AndroidFiles: {save(...args) { saves.push(args); return nativeAccepts; }, report(text) { reports.push(text); }},
        fetch(url) {
            urls.push(url); // Must run synchronously, before upstream revokes the URL.
            return Promise.resolve({ok: !fetchFails, async blob() {
                return oversized ? {size: 32 * 1024 * 1024 + 1} : new Blob(['á JSON\n\u0000'], {type: 'application/json'});
            }});
        },
    });
    const flush = () => new Promise(resolve => setImmediate(resolve));
    vm.runInContext(source, context);
    const override = Anchor.prototype.click;
    vm.runInContext(source, context);
    assert.equal(Anchor.prototype.click, override, 'install is idempotent');
    const a = Object.assign(new Anchor(), {href: 'blob:scene', download: 'escena.json'});
    a.click();
    assert.deepEqual(urls, ['blob:scene'], 'blob is fetched before returning to upstream');
    a.click();
    assert.match(reports.at(-1), /pendiente/, 'second click cannot overwrite pending save');
    await flush();
    assert.equal(saves.length, 1);
    assert.equal(saves[0][0], 'escena.json');
    assert.equal(Buffer.from(saves[0][1], 'base64').toString(), 'á JSON\n\u0000', 'Unicode and binary bytes survive base64');
    assert.equal(saves[0][2], 'application/json');
    a.click(); await flush();
    assert.equal(saves.length, 1, 'busy until Android reports a result');
    for (const status of ['cancelled', 'error', 'saved']) {
        events['cadcraft-file-save']({detail: {status}});
        a.click(); await flush();
    }
    assert.equal(saves.length, 4, 'cancel, failure and success each permit retry');
    events['cadcraft-file-save']({detail: {status: 'saved'}});
    const link = Object.assign(new Anchor(), {href: 'https://example.org/help'});
    link.click();
    assert.equal(link.browserClicks, 1, 'ordinary navigation keeps browser behavior');
    let prevented = false, stopped = false;
    a.href = 'data:application/json;base64,e30=';
    clicks.click({target: {closest: () => a}, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; }});
    await flush();
    assert.ok(prevented && stopped, 'real download-link tap is intercepted exactly once');
    assert.equal(saves.length, 5);
    for (const mode of ['fetch', 'read', 'abort', 'size', 'native']) {
        events['cadcraft-file-save']({detail: {status: 'cancelled'}});
        fetchFails = mode === 'fetch'; readFails = mode === 'read'; aborts = mode === 'abort';
        oversized = mode === 'size'; nativeAccepts = mode !== 'native';
        const previous = reports.length;
        a.click(); await flush();
        assert.equal(reports.length, previous + 1, mode + ' failure is visible');
        assert.match(reports.at(-1), /^Guardar:/);
        fetchFails = readFails = aborts = oversized = false; nativeAccepts = true;
        const count = saves.length;
        a.click(); await flush();
        assert.equal(saves.length, count + 1, mode + ' failure releases bridge for retry');
    }
    console.log('Android file bridge tests passed (downloads, bytes, single-flight, outcomes and retry)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
