/* 参考图库面板：读取 /api/media 里带 refTags 的素材，按 姿势 / 服装 / 人像 整理。
   拖到画布走映流原有的素材拖拽协议，点击则直接落到画布中央。 */
(function () {
  'use strict';

  const DRAG = 'application/x-creation-canvas-media';
  const SEASON = { spring: '春', summer: '夏', autumn: '秋', winter: '冬', party: '派对' };
  const HAIR = { short: '短发', medium: '中发', semilong: '中长发', long: '长发' };
  const ANGLE = { front: '正面', diagonal: '斜侧', side: '侧面', high: '俯视', low: '仰视' };
  const ORDER = {
    pose: ['站姿', '前倾', '后仰・挺背', '扭身', '上半身'],
    costume: ['春', '夏', '秋', '冬', '派对'],
    face: ['短发', '中发', '中长发', '长发']
  };
  // 服装标签原库只有英文，这里补中文别名，让中文搜索也能命中
  const TAG_ZH = {
    bag: '包', mini: '迷你', black: '黑', skirt: '裙 半身裙', knit: '针织', dress: '连衣裙',
    boots: '靴', socks: '袜', lace: '蕾丝', white: '白', ribbon: '蝴蝶结', sandals: '凉鞋',
    leather: '皮革', stockings: '丝袜', brown: '棕', camisole: '吊带背心', tights: '连裤袜',
    cardigan: '开衫', necklace: '项链', ivory: '象牙白', satin: '缎面', pants: '裤',
    jacket: '夹克', heels: '高跟鞋', shorts: '短裤', beige: '米色', grey: '灰', denim: '牛仔',
    pleated: '百褶', red: '红', gold: '金', blue: '蓝', shirt: '衬衫', fur: '毛', navy: '藏青',
    silver: '银', frill: '荷叶边', choker: '颈饰', midi: '中长', coat: '大衣', bra: '内衣',
    briefs: '内裤', pink: '粉', sneakers: '球鞋', suede: '麂皮', green: '绿', blouse: '衬衫',
    tote: '托特包', loafers: '乐福鞋', belt: '腰带', mint: '薄荷', hat: '帽', jeans: '牛仔裤',
    wool: '羊毛', cream: '奶油白', headband: '发箍', floral: '碎花', corset: '束腰',
    velvet: '天鹅绒', pumps: '单鞋', gloves: '手套', turtleneck: '高领', sunglasses: '墨镜',
    yellow: '黄', khaki: '卡其', burgundy: '酒红', orange: '橙', corduroy: '灯芯绒',
    scarf: '围巾', robe: '长袍', swimsuit: '泳装', sweater: '毛衣', chiffon: '雪纺',
    olive: '橄榄绿', tulle: '纱', mesh: '网纱', beret: '贝雷帽', vest: '马甲', hoodie: '卫衣',
    apron: '围裙', maxi: '长款', 'polka-dot': '波点', lavender: '薰衣草', beanie: '毛线帽',
    muffler: '围巾', purple: '紫'
  };

  const state = { kind: 'pose', filter: 'all', search: '', items: [], loaded: false, loading: false };

  const $ = (selector, root = document) => root.querySelector(selector);

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function refTag(item) {
    const tags = item && item.refTags;
    return tags && typeof tags === 'object' ? tags : null;
  }

  function groupOf(item) {
    const tags = refTag(item) || {};
    if (state.kind === 'pose') return tags.series === 'upper' ? '上半身' : (tags.category || '其他');
    if (state.kind === 'costume') return SEASON[tags.season] || tags.season || '其他';
    return HAIR[tags.hair] || tags.hair || '其他';
  }

  function labelOf(item) {
    const tags = refTag(item) || {};
    const raw = String(item.name || '').replace(/^参考_/, '');
    const id = raw.split('_').pop() || '';
    if (state.kind === 'pose') {
      return tags.name_zh || raw.split('_').slice(2, -1).join(' ') || '姿态';
    }
    if (state.kind === 'costume') return id || '服装';
    return id || '人像';
  }

  function badgeOf(item) {
    const tags = refTag(item) || {};
    if (state.kind === 'pose') return ANGLE[tags.angle] || '';
    if (state.kind === 'costume') return SEASON[tags.season] || '';
    return HAIR[tags.hair] || '';
  }

  function haystack(item) {
    const tags = refTag(item) || {};
    const raw = Array.isArray(tags.tags) ? tags.tags : [];
    const extra = raw.concat(raw.map(tag => TAG_ZH[tag] || '')).concat([
      tags.name_zh || '', tags.category || '', tags.season || '', tags.hair || '', labelOf(item)
    ]);
    return (String(item.name || '') + ' ' + extra.join(' ')).toLowerCase();
  }

  function allItems() {
    return state.items.filter(item => refTag(item) && refTag(item).kind === state.kind);
  }

  function visibleItems() {
    const kw = state.search.trim().toLowerCase();
    return allItems().filter(item =>
      (state.filter === 'all' || groupOf(item) === state.filter) &&
      (!kw || haystack(item).includes(kw)));
  }

  function renderFilters() {
    const box = $('#refs-filters');
    if (!box) return;
    const groups = [];
    allItems().forEach(item => {
      const group = groupOf(item);
      if (!groups.includes(group)) groups.push(group);
    });
    const order = ORDER[state.kind] || [];
    groups.sort((a, b) => {
      const ai = order.indexOf(a), bi = order.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    if (state.filter !== 'all' && !groups.includes(state.filter)) state.filter = 'all';
    box.innerHTML =
      '<button type="button" class="' + (state.filter === 'all' ? 'active' : '') + '" data-ref-filter="all" aria-pressed="' + (state.filter === 'all') + '">全部</button>' +
      groups.map(group =>
        '<button type="button" class="' + (state.filter === group ? 'active' : '') + '" data-ref-filter="' + esc(group) + '" aria-pressed="' + (state.filter === group) + '">' + esc(group) + '</button>'
      ).join('');
  }

  function render() {
    const list = $('#refs-list');
    if (!list) return;
    if (!state.loaded && state.loading) {
      list.innerHTML = '<div class="list-loading">正在读取参考图…</div>';
      return;
    }
    if (!state.loaded) {
      list.innerHTML = '<div class="ref-empty">参考图库还没有载入。</div>';
      return;
    }
    renderFilters();
    const shown = visibleItems();
    const total = allItems().length;
    const count = $('#refs-count');
    if (count) count.textContent = shown.length === total ? String(total) : shown.length + '/' + total;

    if (!shown.length) {
      list.innerHTML = '<div class="ref-empty">' + (total
        ? '没有匹配的参考图，换个关键词试试。'
        : '还没有这类参考图。把参考图上传到素材库，或重新导入参考包。') + '</div>';
      return;
    }

    list.innerHTML = '<div class="refs-grid">' + shown.map(item =>
      '<button type="button" class="ref-card" draggable="true" data-ref-key="' + esc(item.key || ('asset:' + item.assetId)) + '" title="' + esc(labelOf(item)) + '，拖到画布或点一下添加">' +
        '<img src="' + esc(item.url) + '" alt="' + esc(labelOf(item)) + '" loading="lazy" draggable="false">' +
        (badgeOf(item) ? '<em class="ref-badge">' + esc(badgeOf(item)) + '</em>' : '') +
        '<span>' + esc(labelOf(item)) + '</span>' +
      '</button>'
    ).join('') + '</div>';
  }

  async function load(force) {
    if (state.loading) return;
    if (state.loaded && !force) return;
    state.loading = true;
    render();
    try {
      const response = await fetch('/api/media', { cache: 'no-store' });
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      state.items = items.filter(item => refTag(item) && refTag(item).kind);
      state.loaded = true;
    } catch (error) {
      state.items = [];
      state.loaded = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  function toggle(force) {
    const panel = $('#refs');
    const button = $('#refs-toggle');
    if (!panel || !button) return;
    const open = force == null ? panel.classList.contains('hidden') : !!force;
    if (open) {
      const library = $('#library');
      if (library && !library.classList.contains('hidden')) $('#library-close')?.click();
      load();
    }
    panel.classList.toggle('hidden', !open);
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
  }

  function addToCanvas(key) {
    const bridge = window.YLRefsBridge;
    if (!bridge || typeof bridge.addMediaToCanvas !== 'function') {
      return false;
    }
    if (!bridge.mediaByKey(key)) {
      bridge.toast?.('这份参考还没进素材库，请刷新素材库后重试');
      return false;
    }
    bridge.addMediaToCanvas(key);
    return true;
  }

  function wire() {
    const button = $('#refs-toggle');
    if (!button) return;
    button.addEventListener('click', () => toggle());
    $('#refs-close')?.addEventListener('click', () => toggle(false));

    $('#refs-kinds')?.addEventListener('click', event => {
      const target = event.target.closest('[data-ref-kind]');
      if (!target) return;
      state.kind = target.dataset.refKind;
      state.filter = 'all';
      document.querySelectorAll('#refs-kinds [data-ref-kind]').forEach(item => {
        const active = item === target;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      render();
    });

    $('#refs-filters')?.addEventListener('click', event => {
      const target = event.target.closest('[data-ref-filter]');
      if (!target) return;
      state.filter = target.dataset.refFilter;
      render();
    });

    const search = $('#refs-search');
    search?.addEventListener('input', () => {
      state.search = search.value;
      render();
    });

    const list = $('#refs-list');
    list?.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-ref-key]');
      if (!card) return;
      event.dataTransfer.setData(DRAG, card.dataset.refKey);
      event.dataTransfer.effectAllowed = 'copy';
    });
    list?.addEventListener('click', event => {
      const card = event.target.closest('[data-ref-key]');
      if (!card) return;
      if (addToCanvas(card.dataset.refKey)) card.classList.add('is-added');
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const panel = $('#refs');
      if (panel && !panel.classList.contains('hidden')) toggle(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire, { once: true });
  } else {
    wire();
  }
})();
