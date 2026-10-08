'use strict'
// 仅为可选本地预览；直接打开 index.html 不需要启动此服务。
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' }
const server = http.createServer((request, response) => {
  let relative
  try { relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html' } catch (_) { response.writeHead(400); response.end('Bad request'); return }
  const target = path.resolve(root, relative)
  const segments = relative.split(/[\\/]/)
  if (!target.startsWith(root + path.sep) || segments.some((part) => part.startsWith('.') || ['node_modules', 'tests', 'scripts', 'artifacts'].includes(part))) { response.writeHead(403); response.end('Forbidden'); return }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return }
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    fs.createReadStream(target).on('error', () => response.destroy()).pipe(response)
  })
})
server.on('error', (error) => { console.error(`预览服务启动失败：${error.message}`); process.exitCode = 1 })
server.listen(4173, '127.0.0.1', () => console.log('打开 http://127.0.0.1:4173 ，按 Ctrl+C 停止。'))
