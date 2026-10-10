(function () {
  'use strict'
  const api = window.ShiguangStore
  const main = document.querySelector('#main')
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
  const safeImage = (value) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value || '')
  // 延后读取存储，让浏览器禁用 localStorage 时也能呈现错误提示。
  const store = api.createStore({ getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: (key) => window.localStorage.removeItem(key) })
  const filters = { home: { query: '', type: 'all', category: '全部', status: 'open' }, mine: { query: '', type: 'all', category: '全部', status: 'all' } }
  let currentPage = 'home'
  let pendingConfirm = null
  let selectedImage = ''
  let imageBusy = false
  let photoGeneration = 0
  let nicknameContinuation = null
  let toastTimer
  function toast(message) {
    const element = document.querySelector('#toast')
    element.textContent = message
    element.classList.add('visible')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => element.classList.remove('visible'), 3200)
  }
  function errorView(message) {
    main.innerHTML = `<section class="empty"><div class="empty-icon">🌿</div><h2>暂时无法读取数据</h2><p>${esc(message)}</p><button class="button primary" data-action="retry">重新读取</button></section>`
  }
  function updateNickname() {
    const nickname = store.profile().nickname
    document.querySelector('#nickname-button').textContent = nickname ? `◉ ${nickname}` : '设置昵称'
  }
  function openNickname(continuation) {
    nicknameContinuation = continuation || null
    document.querySelector('#nickname-input').value = store.profile().nickname
    document.querySelector('#nickname-error').textContent = ''
    document.querySelector('#nickname-dialog').showModal()
    document.querySelector('#nickname-input').focus()
  }
  function confirmAction(title, description, action, destructive) {
    pendingConfirm = action
    document.querySelector('#confirm-title').textContent = title
    document.querySelector('#confirm-description').textContent = description
    const button = document.querySelector('#confirm-action')
    button.className = `button ${destructive ? 'danger' : 'primary'}`
    button.textContent = destructive ? '确认删除' : '确认更新'
    document.querySelector('#confirm-dialog').showModal()
  }
  function visual(item) {
    return safeImage(item.image) ? `<img src="${esc(item.image)}" alt="${esc(item.title)}的照片">` : `<span class="item-emoji" aria-hidden="true">${api.emoji[item.category] || '📦'}</span>`
  }
  function card(item) {
    return `<article class="card"><a class="card-link" href="#detail?id=${encodeURIComponent(item.id)}" aria-label="查看${esc(item.title)}详情">
      <div class="card-visual" data-category="${esc(item.category)}">${visual(item)}<span class="badge ${item.status === 'closed' ? 'closed' : item.type}">${api.statusLabel(item)}</span>${item.demo ? '<span class="demo-tag">示例</span>' : ''}</div>
      <div class="card-body"><div class="card-title"><h3>${esc(item.title)}</h3><span class="category-tag">${esc(item.category)}</span></div><p>⌖ ${esc(item.location)}</p><p>${esc(item.description)}</p><div class="card-footer"><span>${esc(item.owner)} · ${esc(item.date)}</span><span class="card-arrow">查看 →</span></div></div>
    </a></article>`
  }
  function hero() {
    return `<section class="hero"><div><p class="eyebrow">LOST & FOUND · ON CAMPUS</p><h1>让遗失有回音，<br><span>让善意被看见。</span></h1><p class="muted">也许你正在寻找的，就在这里。<br>汇集校园寻物与招领信息，一起让物品回到主人身边。</p><div class="hero-actions"><a href="#publish?type=lost" class="button primary">我丢了东西 ↗</a><a href="#publish?type=found" class="button ghost">我捡到东西 ＋</a></div></div><img src="assets/campus.svg" alt="校园图书馆与同学的插画"></section>`
  }
  function listing(page) {
    currentPage = page
    const options = filters[page]
    main.innerHTML = `${page === 'home' ? hero() : '<div class="page-top"><p class="eyebrow">MY POSTS</p><h1>我的发布</h1><p class="muted">物品找回或归还后，记得更新状态，让等待有个圆满的结尾。</p></div>'}
      <div class="section-heading"><h2>${page === 'home' ? '寻物广场' : '发布记录'}</h2><p class="muted">${page === 'home' ? '每一条线索，都是一次重逢的可能' : '仅展示当前浏览器发布的物品'}</p></div>
      <section class="search-panel" aria-label="搜索和筛选"><div class="filter-top"><label class="search-box"><span aria-hidden="true">⌕</span><input id="search-input" type="search" aria-label="搜索物品" placeholder="搜索物品名称、特征或地点…" value="${esc(options.query)}" maxlength="100"></label><div class="segmented" aria-label="信息类型">${[['all', '全部信息'], ['lost', '寻物启事'], ['found', '失物招领']].map(([value, label]) => `<button type="button" data-filter="type" data-value="${value}" aria-pressed="${options.type === value}" class="${options.type === value ? 'selected' : ''}">${label}</button>`).join('')}</div></div>
      <div class="filter-bottom"><div class="chips" aria-label="物品分类">${['全部', ...api.categories].map((value) => `<button type="button" class="chip ${options.category === value ? 'selected' : ''}" data-filter="category" data-value="${esc(value)}" aria-pressed="${options.category === value}">${esc(value)}</button>`).join('')}</div><label class="status-filter">物品状态<select id="status-select">${[['open', '进行中'], ['all', '全部状态'], ['closed', '已完成']].map(([value, label]) => `<option value="${value}" ${value === options.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div></section>
      <p class="results-note" id="results-note" role="status"></p><section class="cards" id="cards" aria-label="物品列表"></section>`
    renderCards()
    document.querySelector('#search-input').addEventListener('input', (event) => { options.query = event.target.value; renderCards() })
    document.querySelector('#status-select').addEventListener('change', (event) => { options.status = event.target.value; renderCards() })
  }
  function renderCards() {
    const all = currentPage === 'mine' ? store.mine() : store.list()
    const items = api.filter(all, filters[currentPage])
    document.querySelector('#results-note').textContent = `共 ${items.length} 条信息${currentPage === 'home' ? ' · 带“示例”标签的记录仅用于演示' : ''}`
    document.querySelector('#cards').innerHTML = items.length ? items.map(card).join('') : `<div class="empty"><div class="empty-icon">📭</div><h2>${all.length ? '没有找到匹配的信息' : '还没有发布记录'}</h2><p>${all.length ? '试试其他关键词，或者调整分类和状态筛选。' : '发布一条寻物或招领信息，让校园里的善意流动起来。'}</p>${all.length ? '<button data-action="reset-filters" class="button secondary">清除筛选</button>' : '<a href="#publish" class="button primary">发布第一条信息</a>'}</div>`
  }
  function publish(params) {
    const draft = store.draft()
    const requested = params.get('type')
    const type = ['lost', 'found'].includes(requested) ? requested : (draft.type === 'found' ? 'found' : 'lost')
    selectedImage = safeImage(draft.image) ? draft.image : ''
    const today = api.day(new Date())
    main.innerHTML = `<a class="back-link" href="#home">← 返回寻物广场</a><div class="page-top"><p class="eyebrow">SHARE A CLUE</p><h1>发布一份希望</h1><p class="muted">留下清晰的线索，让物品与主人更快重逢。</p></div><div class="form-layout"><form id="publish-form" class="panel"><div class="form-grid">
      <div class="span-two"><div class="type-options">${[['lost', '我丢了东西', '发布寻物启事'], ['found', '我捡到东西', '发布失物招领']].map(([value, label, note]) => `<label class="type-option"><input type="radio" name="type" value="${value}" ${value === type ? 'checked' : ''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('')}</div></div>
      <label class="field">物品名称 *<input name="title" required maxlength="24" value="${esc(draft.title || '')}" placeholder="例如：白色无线耳机"></label>
      <label class="field">物品分类 *<select name="category">${api.categories.map((category) => `<option ${draft.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label>
      <label class="field">丢失 / 拾取日期 *<input name="date" type="date" required max="${today}" value="${esc(draft.date || today)}"></label>
      <label class="field">丢失 / 拾取地点 *<input name="location" required maxlength="60" value="${esc(draft.location || '')}" placeholder="例如：图书馆三楼靠窗座位"></label>
      <label class="field span-two">物品描述 *<textarea name="description" required minlength="6" maxlength="300" placeholder="描述颜色、外观、特别标记等，至少 6 个字。保留少量细节用于核实失主。">${esc(draft.description || '')}</textarea><small>最多 300 字。不建议公开学号、身份证号码等敏感信息。</small></label>
      <label class="field span-two">联系方式 *<input name="contact" required maxlength="80" value="${esc(draft.contact || '')}" placeholder="例如：微信：your_wechat"><small>联系方式会展示给查看详情的人，请填写你愿意公开的联系方式。</small></label>
      <div class="span-two"><p class="field" style="margin-bottom:10px">物品照片 <small>选填</small></p><div class="upload-box"><div id="photo-preview" class="photo-preview">${selectedImage ? `<img src="${esc(selectedImage)}" alt="照片预览">` : '＋'}</div><div class="upload-tools"><label for="photo-input" class="text-button">选择一张照片</label><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp"><p>JPG / PNG / WebP，最大 5 MB。照片自动压缩并保存到当前浏览器。</p><button type="button" id="remove-photo" class="text-button" ${selectedImage ? '' : 'hidden'}>移除照片</button></div></div></div>
      </div><p id="publish-error" class="form-error" role="alert"></p><div class="form-actions"><p class="muted" id="draft-note">填写内容自动保留为本地草稿</p><button class="button primary" id="publish-submit" type="submit">发布信息 ↗</button></div></form><aside class="aside-tip"><p class="tip-number">A SMALL ACT OF KINDNESS</p><h3>写清楚，更容易找到</h3><p>物品外观 + 时间 + 具体地点，就是最有用的三条线索。</p><hr><h3>找回之后</h3><p>进入“我的发布”，将寻物标为“已找回”，或将招领标为“已归还”。</p><hr><p>信息仅保存在当前浏览器，不支持跨设备同步。</p></aside></div>`
    const form = document.querySelector('#publish-form')
    form.addEventListener('input', saveDraft)
    form.addEventListener('change', saveDraft)
    document.querySelector('#photo-input').addEventListener('change', choosePhoto)
    document.querySelector('#remove-photo').addEventListener('click', () => { photoGeneration++; imageBusy = false; selectedImage = ''; updatePhoto(); saveDraft(); document.querySelector('#photo-input').value = ''; document.querySelector('#publish-error').textContent = '' })
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (imageBusy) { document.querySelector('#publish-error').textContent = '照片正在处理，请稍等'; return }
      const submit = () => {
        try {
          const payload = formData()
          const item = store.add(payload)
          store.clearDraft()
          location.hash = `detail?id=${encodeURIComponent(item.id)}`
          toast('发布成功，信息已保存在当前浏览器')
        } catch (error) { document.querySelector('#publish-error').textContent = error.message }
      }
      try { api.validate(formData(), today); if (!store.profile().nickname) openNickname(submit); else submit() } catch (error) { document.querySelector('#publish-error').textContent = error.message }
    })
  }
  function formData() {
    const form = document.querySelector('#publish-form')
    return { ...Object.fromEntries(new FormData(form)), image: selectedImage }
  }
  function saveDraft() {
    if (!document.querySelector('#publish-form')) return
    try { store.saveDraft(formData()); document.querySelector('#draft-note').textContent = '草稿已自动保存在当前浏览器' } catch (error) { document.querySelector('#draft-note').textContent = error.message }
  }
  function updatePhoto() {
    document.querySelector('#photo-preview').innerHTML = selectedImage ? `<img src="${esc(selectedImage)}" alt="照片预览">` : '＋'
    document.querySelector('#remove-photo').hidden = !selectedImage
    document.querySelector('#publish-submit').disabled = imageBusy
    document.querySelector('#publish-submit').textContent = imageBusy ? '照片处理中…' : '发布信息 ↗'
  }
  async function choosePhoto(event) {
    const file = event.target.files[0]
    if (!file) return
    const generation = ++photoGeneration
    const errorElement = document.querySelector('#publish-error')
    errorElement.textContent = ''
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片')
      if (file.size > 5 * 1024 * 1024) throw new Error('照片不能超过 5 MB')
      imageBusy = true
      updatePhoto()
      const url = URL.createObjectURL(file)
      let image
      try {
        image = await new Promise((resolve, reject) => { const photo = new Image(); photo.onload = () => resolve(photo); photo.onerror = () => reject(new Error('图片无法读取，请重新选择')); photo.src = url })
      } finally { URL.revokeObjectURL(url) }
      if (image.width * image.height > 50000000) throw new Error('图片分辨率过大，请选择较小的照片')
      const ratio = Math.min(1, 1000 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio))
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height)
      let data = canvas.toDataURL('image/jpeg', .78)
      if (data.length > 1500000) data = canvas.toDataURL('image/jpeg', .5)
      if (data.length > 1500000) throw new Error('压缩后照片仍过大，请换一张照片')
      if (generation !== photoGeneration || !document.querySelector('#publish-form')) return
      selectedImage = data
      saveDraft()
    } catch (error) { if (generation === photoGeneration && document.querySelector('#publish-form')) errorElement.textContent = error.message }
    finally { if (generation === photoGeneration && document.querySelector('#publish-form')) { imageBusy = false; updatePhoto() } }
  }
  function detail(id) {
    const item = store.get(id)
    if (!item) { main.innerHTML = '<section class="empty"><div class="empty-icon">📭</div><h2>这条信息不存在或已删除</h2><p>你可以返回广场，查看其他校园线索。</p><a href="#home" class="button primary">返回首页</a></section>'; return }
    const closeLabel = item.type === 'lost' ? '标记已找回' : '标记已归还'
    main.innerHTML = `<a class="back-link" href="#${item.mine ? 'mine' : 'home'}">← 返回${item.mine ? '我的发布' : '寻物广场'}</a><article class="detail-layout"><div class="detail-visual">${visual(item)}</div><div class="detail-content"><span class="badge ${item.type}">${api.statusLabel(item)}</span>${item.demo ? ' <span class="badge">示例信息</span>' : ''}<h1>${esc(item.title)}</h1><p class="muted">${esc(item.owner)} 发布 · ${esc(item.createdAt.slice(0, 10))}</p><dl class="detail-meta"><div><dt>信息类型</dt><dd>${item.type === 'lost' ? '寻物启事' : '失物招领'}</dd></div><div><dt>物品分类</dt><dd>${esc(item.category)}</dd></div><div><dt>丢失 / 拾取地点</dt><dd>${esc(item.location)}</dd></div><div><dt>丢失 / 拾取日期</dt><dd>${esc(item.date)}</dd></div></dl><h3>物品线索</h3><p class="detail-description">${esc(item.description)}</p><div class="detail-actions">${item.mine ? `<button class="button primary" data-action="status" data-id="${esc(item.id)}">${item.status === 'closed' ? '重新开启' : closeLabel}</button><button class="button danger" data-action="delete" data-id="${esc(item.id)}">删除信息</button>` : item.status === 'closed' ? '<p class="safety-note">这条信息已完成，无需重复联系发布者。</p>' : `<button class="button primary" data-action="contact" data-id="${esc(item.id)}">查看联系方式 ↗</button>`}</div></div></article>`
  }
  function route() {
    photoGeneration++; imageBusy = false
    const [page, query] = (location.hash.slice(1) || 'home').split('?')
    const params = new URLSearchParams(query || '')
    currentPage = ['home', 'mine', 'publish', 'detail'].includes(page) ? page : 'home'
    document.querySelectorAll('[data-nav]').forEach((element) => element.classList.toggle('active', element.dataset.nav === currentPage))
    try {
      updateNickname()
      if (currentPage === 'publish') publish(params)
      else if (currentPage === 'detail') detail(params.get('id'))
      else listing(currentPage)
    } catch (error) { errorView(error.message) }
    window.scrollTo(0, 0)
  }
  main.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-filter]')
    if (filter) {
      filters[currentPage][filter.dataset.filter] = filter.dataset.value
      main.querySelectorAll(`[data-filter="${filter.dataset.filter}"]`).forEach((button) => { const selected = button.dataset.value === filter.dataset.value; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)) })
      try { renderCards() } catch (error) { errorView(error.message) }
      return
    }
    const action = event.target.closest('[data-action]')
    if (!action) return
    try {
      if (action.dataset.action === 'retry') route()
      if (action.dataset.action === 'reset-filters') { filters[currentPage] = { query: '', type: 'all', category: '全部', status: currentPage === 'home' ? 'open' : 'all' }; listing(currentPage) }
      const item = action.dataset.id ? store.get(action.dataset.id) : null
      if (action.dataset.id && !item) { toast('这条信息已删除'); route(); return }
      if (action.dataset.action === 'contact') {
        document.querySelector('#contact-owner').textContent = `${item.owner}${item.demo ? ' · 虚构示例联系方式' : ''}`
        document.querySelector('#contact-value').value = item.contact
        document.querySelector('#contact-dialog').showModal()
      }
      if (action.dataset.action === 'status') confirmAction(item.status === 'closed' ? '重新开启这条信息？' : `确认${item.type === 'lost' ? '已找回' : '已归还'}？`, item.status === 'closed' ? '重新开启后，会恢复到广场进行中的信息列表。' : '完成后的信息会保留，但默认不再出现在广场进行中的列表里。', () => { store.setStatus(item.id, item.status === 'closed' ? 'open' : 'closed'); route(); toast('状态已更新') })
      if (action.dataset.action === 'delete') confirmAction('删除这条信息？', '删除后无法恢复。只会删除当前浏览器中的这条发布记录。', () => { store.remove(item.id); location.hash = 'mine'; toast('信息已删除') }, true)
    } catch (error) { toast(error.message) }
  })
  document.querySelector('#nickname-button').addEventListener('click', () => { try { openNickname() } catch (error) { toast(error.message) } })
  document.querySelector('#nickname-form').addEventListener('submit', (event) => {
    event.preventDefault()
    try {
      store.setNickname(document.querySelector('#nickname-input').value)
      updateNickname()
      const continuation = nicknameContinuation
      nicknameContinuation = null
      document.querySelector('#nickname-dialog').close()
      toast('昵称已保存')
      if (continuation) continuation()
    } catch (error) { document.querySelector('#nickname-error').textContent = error.message }
  })
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()))
  document.querySelector('#nickname-dialog').addEventListener('close', () => { nicknameContinuation = null })
  document.querySelector('#confirm-dialog').addEventListener('close', () => { pendingConfirm = null })
  document.querySelector('#confirm-action').addEventListener('click', () => {
    const action = pendingConfirm
    pendingConfirm = null
    document.querySelector('#confirm-dialog').close()
    try { if (action) action() } catch (error) { toast(error.message) }
  })
  document.querySelector('#copy-contact').addEventListener('click', async () => {
    const input = document.querySelector('#contact-value')
    try {
      if (!navigator.clipboard) throw new Error('不可自动复制')
      await navigator.clipboard.writeText(input.value)
      toast('联系方式已复制')
    } catch (_) { input.focus(); input.select(); toast('请按 Ctrl+C 或长按复制选中的联系方式') }
  })
  window.addEventListener('hashchange', route)
  window.addEventListener('storage', (event) => {
    if (event.key === api.KEY || event.key === null) { if (currentPage === 'publish') { try { updateNickname() } catch (error) { toast(error.message) } } else route() }
  })
  route()
})()
