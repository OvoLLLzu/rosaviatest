/* eslint-disable */
const http = require('http')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

async function serve(dir, port = 5173) {
  const server = http.createServer((req, res) => {
    const reqUrl = decodeURIComponent(req.url.split('?')[0])
    let filePath = path.join(dir, reqUrl)
    if (reqUrl === '/' || !path.extname(reqUrl)) {
      filePath = path.join(dir, 'index.html')
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end('Not found')
      } else {
        res.writeHead(200)
        res.end(data)
      }
    })
  })
  await new Promise((r) => server.listen(port, r))
  return server
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function main() {
  const puppeteer = require('puppeteer')
  const projectRoot = path.resolve(__dirname, '..')
  const distDir = path.join(projectRoot, 'dist')
  const outDir = path.join(projectRoot, 'renders')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

  execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' })

  const port = 5800
  const server = await serve(distDir, port)

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 2880, deviceScaleFactor: 1 })

  const screens = [
    { name: 'home', qs: 'design=home' },
    { name: 'test', qs: 'design=test' },
    { name: 'finish', qs: 'design=finish' },
  ]
  const themes = ['dark', 'light']

  for (const theme of themes) {
    for (const s of screens) {
      const url = `http://localhost:${port}/?preview=design&${s.qs}&theme=${theme}`
      await page.goto(url, { waitUntil: 'networkidle0' })
      await delay(400)
      const file = path.join(outDir, `${s.name}-${theme}.png`)
      await page.screenshot({ path: file, type: 'png', omitBackground: false })
      console.log('Saved', file)
    }
  }

  for (const s of screens) {
    const url = `http://localhost:${port}/?preview=design&${s.qs}&theme=dark&bg=transparent`
    await page.goto(url, { waitUntil: 'networkidle0' })
    await delay(400)
    const file = path.join(outDir, `${s.name}-transparent.png`)
    await page.screenshot({ path: file, type: 'png', omitBackground: true })
    console.log('Saved', file)
  }

  await browser.close()
  server.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})