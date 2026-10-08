(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.ShiguangStore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'
  const KEY = 'shiguang_web_v1'
  const DRAFT_KEY = 'shiguang_web_draft_v1'
  const categories = ['数码', '证件钥匙', '书籍文具', '生活用品', '衣物饰品', '其他']
  const emoji = { 数码: '🎧', 证件钥匙: '🔑', 书籍文具: '📚', 生活用品: '☂️', 衣物饰品: '🧣', 其他: '📦' }
  const clone = (value) => JSON.parse(JSON.stringify(value))
  const text = (value) => typeof value === 'string' ? value.trim() : ''
  function day(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  function statusLabel(item) {
    return item.status === 'closed' ? (item.type === 'lost' ? '已找回' : '已归还') : (item.type === 'lost' ? '寻物中' : '招领中')
  }
  function validate(payload, today) {
    const fields = { title: ['物品名称', 24], description: ['物品描述', 300], location: ['地点', 60], contact: ['联系方式', 80] }
    const result = {}
    for (const [field, [label, maximum]] of Object.entries(fields)) {
      result[field] = text(payload[field])
      if (!result[field]) throw new Error(`请填写${label}`)
      if (result[field].length > maximum) throw new Error(`${label}不能超过 ${maximum} 字`)
    }
    if (result.description.length < 6) throw new Error('描述至少填写 6 个字，方便核对物品')
    if (!['lost', 'found'].includes(payload.type)) throw new Error('请选择寻物或招领')
    if (!categories.includes(payload.category)) throw new Error('请选择有效的物品分类')
    const date = text(payload.date)
    const [year, month, dateOfMonth] = date.split('-').map(Number)
    const parsed = new Date(year, month - 1, dateOfMonth)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || day(parsed) !== date || date > today) throw new Error('请选择有效且不晚于今天的日期')
    const image = payload.image || ''
    if (typeof image !== 'string' || (image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))) throw new Error('图片格式不正确，请重新选择')
    if (image.length > 1500000) throw new Error('图片过大，请选择更小的照片')
    return { ...result, type: payload.type, category: payload.category, date, image }
  }
  function seeds(now) {
    const entries = [
      ['lost', '白色无线耳机', '数码', '图书馆三楼', '白色充电盒，右侧有蓝色星星贴纸。可能落在靠窗的自习座位。', '林小满', 'open', '微信：demo_earphone'],
      ['found', '一串宿舍钥匙', '证件钥匙', '第一食堂门口', '黑色钥匙圈，一共三把钥匙，挂着绿色小恐龙。已交到食堂服务台。', '陈同学', 'open', '微信：demo_keys'],
      ['lost', '蓝色校园卡', '证件钥匙', '知行楼 B203', '卡套是透明的，背面贴着课程表。认领时请说明卡上的姓名。', '周同学', 'open', '微信：demo_card'],
      ['found', '高等数学笔记本', '书籍文具', '博学楼 401', '牛皮纸封面，第一页写着软件工程。里面有整齐的手写笔记。', '王同学', 'open', '微信：demo_notebook'],
      ['found', '米色帆布袋', '衣物饰品', '校园巴士站', '袋子正面印有绿色小树，里面有水杯和一本书，请失主核对。', '小余', 'open', '微信：demo_bag'],
      ['found', '黑色折叠伞', '生活用品', '体育馆西看台', '伞柄上有白色字母，已与失主核对并完成交接，谢谢大家。', '拾光志愿者', 'closed', '微信：demo_umbrella']
    ]
    return entries.map(([type, title, category, location, description, owner, status, contact], index) => {
      const date = new Date(now.getTime() - index * 86400000)
      return { id: `demo-${index + 1}`, ownerId: '__demo__', type, title, category, location, description, owner, status, contact,
        date: day(date), createdAt: date.toISOString(), image: '', demo: true }
    })
  }
  function createStore(storage, options = {}) {
    const now = options.now || (() => new Date())
    const id = options.id || (() => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    function read() {
      let raw
      try { raw = storage.getItem(KEY) } catch (_) { throw new Error('无法读取浏览器存储，请使用普通模式的 Chrome 打开') }
      if (raw === null) {
        const state = { version: 1, ownerId: id(), nickname: '', items: seeds(now()) }
        write(state)
        return state
      }
      let state
      try { state = JSON.parse(raw) } catch (_) { throw new Error('本地数据无法读取；请勿清除浏览器数据，可先联系开发者排查') }
      if (!state || state.version !== 1 || typeof state.ownerId !== 'string' || !state.ownerId || typeof state.nickname !== 'string' || !Array.isArray(state.items) ||
        state.items.some((item) => !item || typeof item.id !== 'string' || typeof item.ownerId !== 'string' || !['lost', 'found'].includes(item.type) || !['open', 'closed'].includes(item.status) ||
          ['title', 'description', 'location', 'category', 'contact', 'date', 'createdAt', 'owner', 'image'].some((field) => typeof item[field] !== 'string'))) {
        throw new Error('本地数据格式不正确；原数据已保留，请联系开发者排查')
      }
      return state
    }
    function write(state) {
      try { storage.setItem(KEY, JSON.stringify(state)) } catch (_) { throw new Error('保存失败：浏览器存储空间不足或被禁用。请移除照片后重试') }
    }
    function list() {
      const state = read()
      return state.items.map((item) => ({ ...item, mine: item.ownerId === state.ownerId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    function owned(state, itemId) {
      const item = state.items.find((entry) => entry.id === itemId)
      if (!item) throw new Error('这条信息不存在或已删除')
      if (item.ownerId !== state.ownerId) throw new Error('只能管理自己发布的信息')
      return item
    }
    return {
      list,
      get: (itemId) => list().find((item) => item.id === itemId) || null,
      mine: () => list().filter((item) => item.mine),
      profile: () => ({ nickname: read().nickname }),
      setNickname(value) {
        const nickname = text(value)
        if (!nickname || nickname.length > 20) throw new Error('昵称请填写 1–20 个字')
        const state = read()
        state.nickname = nickname
        write(state)
        return { nickname }
      },
      add(payload) {
        const clean = validate(payload, day(now()))
        const state = read()
        if (!state.nickname) throw new Error('请先设置昵称')
        const item = { ...clean, id: id(), ownerId: state.ownerId, owner: state.nickname, status: 'open', createdAt: now().toISOString(), demo: false }
        if (state.items.some((entry) => entry.id === item.id)) throw new Error('生成编号失败，请重新发布')
        state.items.unshift(item)
        write(state)
        return { ...item, mine: true }
      },
      setStatus(itemId, status) {
        if (!['open', 'closed'].includes(status)) throw new Error('无效的物品状态')
        const state = read()
        const item = owned(state, itemId)
        item.status = status
        write(state)
        return { ...item, mine: true }
      },
      remove(itemId) {
        const state = read()
        owned(state, itemId)
        state.items = state.items.filter((item) => item.id !== itemId)
        write(state)
      },
      draft() {
        try { const value = JSON.parse(storage.getItem(DRAFT_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? clone(value) : {} } catch (_) { return {} }
      },
      saveDraft(value) {
        const fields = ['type', 'title', 'category', 'date', 'location', 'description', 'contact', 'image']
        const draft = Object.fromEntries(fields.filter((field) => typeof value[field] === 'string').map((field) => [field, value[field]]))
        try { storage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch (_) { throw new Error('草稿未能保存，请不要关闭页面；可移除照片后重试') }
      },
      clearDraft() { try { storage.removeItem(DRAFT_KEY) } catch (_) { /* 发布已保存时不能误报发布失败。 */ } }
    }
  }
  function filter(items, options = {}) {
    const query = text(options.query).toLocaleLowerCase()
    return items.filter((item) =>
      (!options.type || options.type === 'all' || item.type === options.type) &&
      (!options.category || options.category === '全部' || item.category === options.category) &&
      (!options.status || options.status === 'all' || item.status === options.status) &&
      (!query || `${item.title} ${item.description} ${item.location} ${item.category}`.toLocaleLowerCase().includes(query)))
  }
  return { createStore, categories, emoji, statusLabel, filter, validate, day, KEY, DRAFT_KEY }
})
