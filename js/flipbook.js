var H5P = H5P || {};

H5P.FlipBook = (function ($, EventDispatcher) {
  'use strict';

  var LIBRARY_FOLDER = 'H5P.FlipBook-1.0';
  var SWIPE_THRESHOLD = 50;

  function FlipBook(params, contentId, extras) {
    EventDispatcher.call(this);

    this.params = params || {};
    this.contentId = contentId;
    this.extras = extras || {};
    this.l10n = Object.assign({
      prevPage: 'Previous page',
      nextPage: 'Next page',
      toggleFullscreen: 'Toggle fullscreen',
      pageCount: '@count pages',
      pageProgress: '@current / @total',
      loading: 'Loading…',
      pdfLoadError: 'Could not load the PDF.'
    }, this.params.l10n || {});
    this.behaviour = Object.assign({
      enableFullscreen: true,
      enableSwipe: true
    }, this.params.behaviour || {});

    this.currentPage = 1;
    this.numPages = 0;
    this.maxPageReached = 1;
    this.pageAspectRatio = null;
    this.renderSeq = 0;
    this.renderer = null;
    this.renderDebounceTimer = null;
    this.layoutStabilizerTimer = null;
  }

  FlipBook.prototype = Object.create(EventDispatcher.prototype);
  FlipBook.prototype.constructor = FlipBook;

  FlipBook.prototype.attach = function ($container) {
    var container = $container.get ? $container.get(0) : $container;
    container.classList.add('h5p-pdf-flipbook');
    this.container = container;
    this.buildDom();
    this.bindEvents();
    this.loadPdf();
  };

  FlipBook.prototype.buildDom = function () {
    var c = this.container;
    c.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'h5p-pdf-flipbook__header';
    this.header = header;
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'h5p-pdf-flipbook__title';
    this.titleEl.textContent = (this.params.title || this.extras.metadata && this.extras.metadata.title) || '';
    this.pageCountEl = document.createElement('div');
    this.pageCountEl.className = 'h5p-pdf-flipbook__page-count';
    header.appendChild(this.titleEl);
    header.appendChild(this.pageCountEl);

    var stage = document.createElement('div');
    stage.className = 'h5p-pdf-flipbook__stage';
    stage.setAttribute('role', 'region');
    stage.setAttribute('aria-roledescription', 'carousel');
    stage.setAttribute('aria-label', this.titleEl.textContent || 'Flipbook');
    this.stage = stage;

    this.pageWrap = document.createElement('div');
    this.pageWrap.className = 'h5p-pdf-flipbook__page';
    this.pageWrap.setAttribute('role', 'group');
    this.pageWrap.setAttribute('aria-live', 'polite');
    this.pageWrap.setAttribute('tabindex', '0');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'h5p-pdf-flipbook__canvas';
    this.pageWrap.appendChild(this.canvas);

    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 'h5p-pdf-flipbook__loading';
    this.loadingEl.textContent = this.l10n.loading;
    this.pageWrap.appendChild(this.loadingEl);

    this.prevBtn = this.makeNavButton('prev', this.l10n.prevPage, '‹');
    this.nextBtn = this.makeNavButton('next', this.l10n.nextPage, '›');

    stage.appendChild(this.prevBtn);
    stage.appendChild(this.pageWrap);
    stage.appendChild(this.nextBtn);

    var footer = document.createElement('div');
    footer.className = 'h5p-pdf-flipbook__footer';
    this.footer = footer;
    this.progressEl = document.createElement('div');
    this.progressEl.className = 'h5p-pdf-flipbook__progress';
    this.progressLabel = document.createElement('span');
    this.progressLabel.className = 'h5p-pdf-flipbook__progress-label';
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'h5p-pdf-flipbook__progress-bar';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'h5p-pdf-flipbook__progress-fill';
    this.progressBar.appendChild(this.progressFill);
    this.progressEl.appendChild(this.progressLabel);
    this.progressEl.appendChild(this.progressBar);
    footer.appendChild(this.progressEl);

    if (this.behaviour.enableFullscreen) {
      this.fullscreenBtn = document.createElement('button');
      this.fullscreenBtn.type = 'button';
      this.fullscreenBtn.className = 'h5p-pdf-flipbook__fullscreen';
      this.fullscreenBtn.setAttribute('aria-label', this.l10n.toggleFullscreen);
      this.fullscreenBtn.innerHTML = '<span aria-hidden="true">⛶</span>';
      footer.appendChild(this.fullscreenBtn);
    }

    c.appendChild(header);
    c.appendChild(stage);
    c.appendChild(footer);
  };

  FlipBook.prototype.makeNavButton = function (kind, label, glyph) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'h5p-pdf-flipbook__nav h5p-pdf-flipbook__nav--' + kind;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = '<span aria-hidden="true">' + glyph + '</span>';
    return btn;
  };

  FlipBook.prototype.bindEvents = function () {
    var self = this;

    this.prevBtn.addEventListener('click', function () { self.goTo(self.currentPage - 1); });
    this.nextBtn.addEventListener('click', function () { self.goTo(self.currentPage + 1); });

    this.keyHandler = function (e) {
      if (!self.container.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }
      if (e.key === 'ArrowLeft') { self.goTo(self.currentPage - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { self.goTo(self.currentPage + 1); e.preventDefault(); }
      else if (e.key === 'Escape' && H5P.isFullscreen) { self.exitFullscreen(); }
    };
    document.addEventListener('keydown', this.keyHandler);

    if (this.behaviour.enableSwipe) {
      this.bindSwipe();
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', function () { self.toggleFullscreen(); });
    }

    this.reflow = function () { self.scheduleRender(); };
    window.addEventListener('resize', this.reflow);
    // Canonical H5P resize signal — fired by core on iframe-resizer ticks,
    // fullscreen transitions, and parent-driven layout changes. render()
    // no longer triggers 'resize' itself, so this does not loop.
    this.on('resize', this.reflow);
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(this.reflow);
      this.resizeObserver.observe(this.stage);
    }
    document.addEventListener('fullscreenchange', this.reflow);
    document.addEventListener('webkitfullscreenchange', this.reflow);
  };

  FlipBook.prototype.bindSwipe = function () {
    var self = this;
    var startX = null;
    this.pageWrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { startX = e.touches[0].clientX; }
    }, { passive: true });
    this.pageWrap.addEventListener('touchend', function (e) {
      if (startX === null) { return; }
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        self.goTo(self.currentPage + (dx < 0 ? 1 : -1));
      }
      startX = null;
    });
  };

  FlipBook.prototype.loadPdf = function () {
    var self = this;
    var file = this.params.pdfFile;
    if (!file || !file.path) {
      this.showError(this.l10n.pdfLoadError + ' (no file)');
      return;
    }
    var url = H5P.getPath(file.path, this.contentId);
    var libraryPath = H5P.getLibraryPath(LIBRARY_FOLDER);
    this.renderer = new H5P.FlipBookRenderers.PdfJs(libraryPath);

    this.renderer.loadDocument(url).then(function (info) {
      self.numPages = info.numPages;
      self.pageAspectRatio = info.aspectRatio || null;
      self.updatePageCount();
      self.updatePreferredLayout();
      self.trigger('resize');
      self.render();
      self.stabilizeInitialLayout();
    }).catch(function (err) {
      console.error('H5P.FlipBook: failed to load PDF', err);
      self.showError(self.l10n.pdfLoadError);
    });
  };

  FlipBook.prototype.showError = function (msg) {
    this.loadingEl.textContent = msg;
    this.loadingEl.classList.add('h5p-pdf-flipbook__loading--error');
  };

  FlipBook.prototype.goTo = function (page) {
    if (!this.numPages) { return; }
    if (page < 1 || page > this.numPages || page === this.currentPage) { return; }
    this.currentPage = page;
    if (page > this.maxPageReached) { this.maxPageReached = page; }
    this.render();
    this.fireXAPIProgress();
    if (page === this.numPages) { this.fireXAPICompleted(); }
  };

  FlipBook.prototype.scheduleRender = function () {
    var self = this;
    if (this.renderDebounceTimer) { clearTimeout(this.renderDebounceTimer); }
    this.renderDebounceTimer = setTimeout(function () {
      self.updatePreferredLayout();
      self.render();
    }, 120);
  };

  FlipBook.prototype.render = function () {
    if (!this.renderer || !this.numPages) { return; }
    var self = this;
    var seq = ++this.renderSeq;
    var box = this.computeStageBox();

    this.loadingEl.style.display = '';
    this.renderer.renderPage(this.currentPage, this.canvas, box).then(function () {
      if (seq !== self.renderSeq) { return; }
      self.loadingEl.style.display = 'none';
      self.updateProgress();
      self.updateNavState();
      self.pageWrap.setAttribute('aria-label', 'Page ' + self.currentPage + ' of ' + self.numPages);
      self.pageWrap.focus({ preventScroll: true });
      self.fireXAPIExperienced();
    }).catch(function (err) {
      if (seq !== self.renderSeq) { return; }
      console.error('H5P.FlipBook: render failed', err);
      self.showError(self.l10n.pdfLoadError);
    });
  };

  FlipBook.prototype.computeStageBox = function () {
    var stage = this.stage;
    if (!stage) { return { width: 800, height: 600 }; }
    var cs = window.getComputedStyle(stage);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var w = Math.max(100, stage.clientWidth - padX);
    var h = Math.max(100, stage.clientHeight - padY);
    return { width: w, height: h };
  };

  FlipBook.prototype.updatePreferredLayout = function () {
    if (!this.stage || !this.pageAspectRatio || !this.container) { return; }

    var stage = this.stage;
    var cs = window.getComputedStyle(stage);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var availableWidth = Math.max(100, this.container.clientWidth - padX);
    var preferredStageHeight = Math.min(
      Math.max(480, Math.round(availableWidth * this.pageAspectRatio + padY)),
      1400
    );
    var minHeight = preferredStageHeight + 'px';

    if (stage.style.minHeight !== minHeight) {
      stage.style.minHeight = minHeight;
    }
  };

  FlipBook.prototype.stabilizeInitialLayout = function () {
    var self = this;
    var attempts = 0;
    var previousBox = this.computeStageBox();

    if (this.layoutStabilizerTimer) {
      clearInterval(this.layoutStabilizerTimer);
    }

    this.layoutStabilizerTimer = setInterval(function () {
      attempts += 1;
      self.updatePreferredLayout();
      var nextBox = self.computeStageBox();
      var widthDelta = Math.abs(nextBox.width - previousBox.width);
      var heightDelta = Math.abs(nextBox.height - previousBox.height);

      if (widthDelta > 2 || heightDelta > 2) {
        previousBox = nextBox;
        self.trigger('resize');
      }

      if (attempts >= 6) {
        clearInterval(self.layoutStabilizerTimer);
        self.layoutStabilizerTimer = null;
      }
    }, 250);
  };

  FlipBook.prototype.updatePageCount = function () {
    this.pageCountEl.textContent = this.l10n.pageCount.replace('@count', this.numPages);
  };

  FlipBook.prototype.updateProgress = function () {
    this.progressLabel.textContent = this.l10n.pageProgress
      .replace('@current', this.currentPage)
      .replace('@total', this.numPages);
    var pct = this.numPages > 1 ? ((this.currentPage - 1) / (this.numPages - 1)) * 100 : 100;
    this.progressFill.style.width = pct + '%';
  };

  FlipBook.prototype.updateNavState = function () {
    this.prevBtn.disabled = this.currentPage <= 1;
    this.nextBtn.disabled = this.currentPage >= this.numPages;
  };

  FlipBook.prototype.toggleFullscreen = function () {
    if (H5P.isFullscreen) { this.exitFullscreen(); } else { this.enterFullscreen(); }
  };

  FlipBook.prototype.enterFullscreen = function () {
    if (!H5P.fullScreen) { return; }
    var $el = (window.H5P.jQuery || window.jQuery)(this.container);
    H5P.fullScreen($el, this);
  };

  FlipBook.prototype.exitFullscreen = function () {
    if (H5P.exitFullScreen) { H5P.exitFullScreen(); }
  };

  FlipBook.prototype.fireXAPIExperienced = function () {
    var ev = this.createXAPIEventTemplate('experienced');
    this.addPageContext(ev);
    this.trigger(ev);
  };

  FlipBook.prototype.fireXAPIProgress = function () {
    var ev = this.createXAPIEventTemplate('progressed');
    this.addPageContext(ev);
    var progress = this.numPages ? this.maxPageReached / this.numPages : 0;
    ev.data.statement.result = {
      extensions: {
        'https://w3id.org/xapi/cmi5/result/extensions/progress': Math.round(progress * 100) / 100
      }
    };
    this.trigger(ev);
  };

  FlipBook.prototype.fireXAPICompleted = function () {
    if (this.completedFired) { return; }
    this.completedFired = true;
    var ev = this.createXAPIEventTemplate('completed');
    this.addPageContext(ev);
    ev.data.statement.result = { completion: true };
    this.trigger(ev);
  };

  FlipBook.prototype.addPageContext = function (ev) {
    var def = ev.getVerifiedStatementValue(['object', 'definition']);
    if (def) {
      def.extensions = def.extensions || {};
      def.extensions['http://id.tincanapi.com/extension/ending-point'] = this.currentPage;
      def.extensions['http://id.tincanapi.com/extension/starting-point'] = this.currentPage;
    }
  };

  FlipBook.prototype.getCurrentState = function () {
    return { currentPage: this.currentPage, maxPageReached: this.maxPageReached };
  };

  return FlipBook;
})(H5P.jQuery, H5P.EventDispatcher);
