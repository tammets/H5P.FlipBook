(function () {
  'use strict';

  var H5P = window.H5P = window.H5P || {};
  H5P.FlipBookRenderers = H5P.FlipBookRenderers || {};

  var pdfjsPromise = null;

  function loadPdfJs(libraryPath) {
    if (pdfjsPromise) {
      return pdfjsPromise;
    }
    var moduleUrl = libraryPath + '/lib/pdf.min.js';
    var workerUrl = libraryPath + '/lib/pdf.worker.min.js';
    pdfjsPromise = import(/* webpackIgnore: true */ moduleUrl).then(function (mod) {
      var pdfjsLib = mod.default || mod;
      // PDF.js normally infers module-worker mode from the .mjs extension.
      // We ship .js (H5P whitelist rejects .mjs), so construct the worker
      // explicitly with { type: 'module' } and hand it over via workerPort.
      pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: 'module' });
      return pdfjsLib;
    });
    return pdfjsPromise;
  }

  function PdfJsRenderer(libraryPath) {
    this.libraryPath = libraryPath;
    this.pdfjsLib = null;
    this.document = null;
  }

  PdfJsRenderer.prototype.loadDocument = function (source) {
    var self = this;
    return loadPdfJs(this.libraryPath).then(function (pdfjsLib) {
      self.pdfjsLib = pdfjsLib;
      return pdfjsLib.getDocument(source).promise;
    }).then(function (doc) {
      self.document = doc;
      return { numPages: doc.numPages };
    });
  };

  PdfJsRenderer.prototype.renderPage = function (pageNumber, canvas, box) {
    if (!this.document) {
      return Promise.reject(new Error('Document not loaded'));
    }
    return this.document.getPage(pageNumber).then(function (page) {
      var baseViewport = page.getViewport({ scale: 1 });
      var scale = Math.min(
        box.width / baseViewport.width,
        box.height / baseViewport.height
      );
      var dpr = window.devicePixelRatio || 1;
      var viewport = page.getViewport({ scale: scale * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
      canvas.style.height = Math.floor(viewport.height / dpr) + 'px';

      var ctx = canvas.getContext('2d');
      var renderTask = page.render({ canvasContext: ctx, viewport: viewport });
      return renderTask.promise.then(function () {
        return {
          width: viewport.width / dpr,
          height: viewport.height / dpr
        };
      });
    });
  };

  PdfJsRenderer.prototype.destroy = function () {
    if (this.document) {
      this.document.destroy();
      this.document = null;
    }
  };

  H5P.FlipBookRenderers.PdfJs = PdfJsRenderer;
})();
