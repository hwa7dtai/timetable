/**
 * 生成 PWA 图标。
 * 不引入图像库，直接用 zlib 写出 PNG：先以 4 倍分辨率绘制，再降采样得到平滑边缘。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SUPERSAMPLE = 4

const BACKGROUND = [59, 110, 245]
const CELL = [255, 255, 255]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = -1
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 位深
  header[9] = 6 // 颜色类型：RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function createCanvas(size) {
  return { size, data: Buffer.alloc(size * size * 4) }
}

function blend(canvas, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return
  const offset = (y * canvas.size + x) * 4
  const inverse = 1 - alpha
  canvas.data[offset] = Math.round(color[0] * alpha + canvas.data[offset] * inverse)
  canvas.data[offset + 1] = Math.round(color[1] * alpha + canvas.data[offset + 1] * inverse)
  canvas.data[offset + 2] = Math.round(color[2] * alpha + canvas.data[offset + 2] * inverse)
  canvas.data[offset + 3] = Math.round(255 * alpha + canvas.data[offset + 3] * inverse)
}

/** 圆角矩形填充，用距离场判断像素是否落在形状内 */
function fillRoundedRect(canvas, x, y, width, height, radius, color, alpha = 1) {
  const startX = Math.max(0, Math.floor(x))
  const endX = Math.min(canvas.size, Math.ceil(x + width))
  const startY = Math.max(0, Math.floor(y))
  const endY = Math.min(canvas.size, Math.ceil(y + height))

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const cx = px + 0.5
      const cy = py + 0.5
      const dx = Math.max(x + radius - cx, 0, cx - (x + width - radius))
      const dy = Math.max(y + radius - cy, 0, cy - (y + height - radius))
      if (Math.hypot(dx, dy) <= radius) {
        blend(canvas, px, py, color, alpha)
      }
    }
  }
}

function downsample(canvas, size) {
  const output = Buffer.alloc(size * size * 4)
  const factor = canvas.size / size
  const samples = factor * factor

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const offset = ((y * factor + sy) * canvas.size + (x * factor + sx)) * 4
          r += canvas.data[offset]
          g += canvas.data[offset + 1]
          b += canvas.data[offset + 2]
          a += canvas.data[offset + 3]
        }
      }
      const target = (y * size + x) * 4
      output[target] = Math.round(r / samples)
      output[target + 1] = Math.round(g / samples)
      output[target + 2] = Math.round(b / samples)
      output[target + 3] = Math.round(a / samples)
    }
  }
  return output
}

/** 画一个「课表网格」图标的像素图 */
function renderIcon(size, { maskable }) {
  const canvas = createCanvas(size * SUPERSAMPLE)
  const scale = SUPERSAMPLE
  const full = size * scale
  const unit = full / 100

  if (maskable) {
    // 可遮罩图标：铺满整块背景，内容保持在中心 80% 安全区内
    fillRoundedRect(canvas, 0, 0, full, full, 0, BACKGROUND)
  } else {
    fillRoundedRect(canvas, 0, 0, full, full, 22 * unit, BACKGROUND)
  }

  const inset = maskable ? 24 : 20
  const gridLeft = inset * unit
  const gridTop = (maskable ? 26 : 22) * unit
  const gridWidth = (100 - inset * 2) * unit
  const gridHeight = (100 - (maskable ? 26 : 22) - (maskable ? 26 : 22)) * unit

  const columns = 3
  const rows = 4
  const gap = 4 * unit
  const cellWidth = (gridWidth - gap * (columns - 1)) / columns
  const cellHeight = (gridHeight - gap * (rows - 1)) / rows
  const radius = Math.min(cellWidth, cellHeight) * 0.22

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // 第一格提亮，暗示「当前课程」
      const alpha = row === 0 && column === 0 ? 1 : 0.88
      fillRoundedRect(
        canvas,
        gridLeft + column * (cellWidth + gap),
        gridTop + row * (cellHeight + gap),
        cellWidth,
        cellHeight,
        radius,
        CELL,
        alpha,
      )
    }
  }

  return downsample(canvas, size)
}

mkdirSync(OUTPUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
]

for (const target of targets) {
  const png = encodePng(target.size, renderIcon(target.size, { maskable: target.maskable }))
  writeFileSync(resolve(OUTPUT_DIR, target.file), png)
  console.log(`生成 ${target.file}（${png.length} 字节）`)
}
