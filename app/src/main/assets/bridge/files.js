/* Android SAF downloads. Fetch the blob before upstream revokes its URL;
 * keep one request active until Android reports the picker/write outcome. */
(function () {
    'use strict';
    if (window.__cadAndroidSaveInstalled || typeof AndroidFiles === 'undefined') return;
    window.__cadAndroidSaveInstalled = true;
    let saving = false;
    const maxBytes = 32 * 1024 * 1024;
    function report(message) { AndroidFiles.report(message); }
    window.addEventListener('cadcraft-file-save', function () { saving = false; });
    async function send(url, name) {
        if (saving) { report('Ya hay un archivo pendiente de guardar'); return; }
        saving = true;
        try {
            const response = await fetch(url);
            if (!response.ok) throw Error('No se pudo leer la descarga');
            const blob = await response.blob();
            if (blob.size > maxBytes) throw Error('El archivo supera 32 MB');
            const base64 = await new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = function () {
                    const data = String(reader.result);
                    const comma = data.indexOf(',');
                    if (comma < 0) { reject(Error('Archivo no válido')); return; }
                    resolve(data.substring(comma + 1));
                };
                reader.onerror = reader.onabort = function () { reject(Error('No se pudo leer el archivo')); };
                reader.readAsDataURL(blob);
            });
            if (!AndroidFiles.save(name || 'dibujo.dxf', base64, blob.type || 'application/octet-stream')) {
                throw Error('No se pudo preparar Guardar como; inténtalo de nuevo');
            }
        } catch (error) {
            saving = false;
            report('Guardar: ' + error.message);
        }
    }
    function downloadable(href) { return href.startsWith('blob:') || href.startsWith('data:'); }
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (downloadable(this.href || '')) { void send(this.href, this.download); return; }
        return original.apply(this, arguments);
    };
    document.addEventListener('click', function (event) {
        const target = event.target;
        const anchor = target && target.closest && target.closest('a[download]');
        if (anchor && downloadable(anchor.href)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void send(anchor.href, anchor.download);
        }
    }, true);
})();
