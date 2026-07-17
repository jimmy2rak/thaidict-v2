// 最小合法 docx 生成器（纯 JS，零外部依赖）。
// 原理：docx 是 ZIP（store·无压缩），内嵌固定 OOXML XML 结构。
// 参考：MDN 指南 + ECMA-376 标准。
// 支持将纯文本（含换行符）渲染为 Word 段落。

/* -------------------- CRC32 -------------------- */
const CRC32_TABLE = new Int32Array(256)
;(() => {
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : (c >>> 1)
    CRC32_TABLE[i] = c
  }
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC32_TABLE[(c ^ buf[i]) & 0xFF]
  return (c ^ 0xFFFFFFFF) >>> 0
}

/* -------------------- ZIP writer（store·no compression） -------------------- */
function makeZip(entries) {
  // entries: [{ name: string, data: Uint8Array }]

  const local = []
  const cd = [] // central directory
  let cdOffset = 0

  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name)
    const crc = crc32(e.data)
    const size = e.data.length

    // Local file header
    const lfh = new ArrayBuffer(30 + nameBytes.length)
    const lfhView = new DataView(lfh)
    lfhView.setUint32(0, 0x04034b50, true) // signature
    lfhView.setUint16(4, 20, true) // version needed
    lfhView.setUint16(6, 0, true) // flags
    lfhView.setUint16(8, 0, true) // compression = store
    lfhView.setUint16(10, 0, true) // mod time
    lfhView.setUint16(12, 0, true) // mod date
    lfhView.setUint32(14, crc, true)
    lfhView.setUint32(18, size, true) // compressed size
    lfhView.setUint32(22, size, true) // uncompressed size
    lfhView.setUint16(26, nameBytes.length, true)
    lfhView.setUint16(28, 0, true) // extra field length
    new Uint8Array(lfh, 30).set(nameBytes)

    // Central directory entry
    const cde = new ArrayBuffer(46 + nameBytes.length)
    const cdeView = new DataView(cde)
    cdeView.setUint32(0, 0x02014b50, true)
    cdeView.setUint16(4, 20, true) // version made by
    cdeView.setUint16(6, 20, true) // version needed
    cdeView.setUint16(8, 0, true) // flags
    cdeView.setUint16(10, 0, true) // compression
    cdeView.setUint16(12, 0, true) // mod time
    cdeView.setUint16(14, 0, true) // mod date
    cdeView.setUint32(16, crc, true)
    cdeView.setUint32(20, size, true) // compressed
    cdeView.setUint32(24, size, true) // uncompressed
    cdeView.setUint16(28, nameBytes.length, true)
    cdeView.setUint16(30, 0, true) // extra
    cdeView.setUint16(32, 0, true) // comment
    cdeView.setUint16(34, 0, true) // disk
    cdeView.setUint16(36, 0, true) // internal attr
    cdeView.setUint32(38, 0, true) // external attr
    cdeView.setUint32(42, cdOffset, true) // relative offset
    new Uint8Array(cde, 46).set(nameBytes)

    local.push({ header: new Uint8Array(lfh), data: e.data })
    cd.push(new Uint8Array(cde))
    cdOffset += 30 + nameBytes.length + size
  }

  // End of central directory
  const cdSize = cd.reduce((s, b) => s + b.byteLength, 0)
  const eocd = new ArrayBuffer(22)
  const eocdView = new DataView(eocd)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(4, 0, true) // disk
  eocdView.setUint16(6, 0, true) // disk start
  eocdView.setUint16(8, entries.length, true) // cd entries on disk
  eocdView.setUint16(10, entries.length, true) // cd entries total
  eocdView.setUint32(12, cdSize, true)
  eocdView.setUint32(16, cdOffset, true)
  eocdView.setUint16(20, 0, true) // comment length

  // Concatenate all
  const totalSize =
    local.reduce((s, e) => s + e.header.byteLength + e.data.byteLength, 0) +
    cdSize +
    22
  const zip = new Uint8Array(totalSize)
  let pos = 0
  for (const e of local) { zip.set(e.header, pos); pos += e.header.byteLength; zip.set(e.data, pos); pos += e.data.byteLength }
  for (const b of cd) { zip.set(b, pos); pos += b.byteLength }
  zip.set(new Uint8Array(eocd), pos)
  return zip
}

/* -------------------- OOXML XML fragments -------------------- */
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildContentTypes() {
  return XML_DECL + `
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
}

function buildRels() {
  return XML_DECL + `
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
}

function buildDocRels() {
  return XML_DECL + `
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
`
}

// 将纯文本按行拆为 <w:p> 段落；以 # 开头的行渲染为标题样式（加粗加大）
function buildDocumentXml(text) {
  const lines = text.split('\n')
  const paragraphs = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      // 空行 → 空段落
      return '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>'
    }
    let boldVal = '0'
    let fontSize = '24' // 12pt
    let spacing = '80'
    if (trimmed.startsWith('# ')) {
      boldVal = '1'
      fontSize = '36' // 18pt
      spacing = '160'
    } else if (trimmed.startsWith('## ')) {
      boldVal = '1'
      fontSize = '30' // 15pt
      spacing = '120'
    } else if (trimmed.startsWith('### ')) {
      boldVal = '1'
      fontSize = '26' // 13pt
      spacing = '100'
    }
    return `<w:p>
  <w:pPr>
    <w:spacing w:after="${spacing}"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="SimSun"/>
      <w:b w:val="${boldVal}"/>
      <w:sz w:val="${fontSize}"/>
    </w:rPr>
    <w:t xml:space="preserve">${escXml(trimmed)}</w:t>
  </w:r>
</w:p>`
  })

  return XML_DECL + `
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join('\n')}
  </w:body>
</w:document>`
}

/* -------------------- 公开 API -------------------- */

/**
 * 生成 docx Blob。text 参数为纯文本（建议先将 markdown 转为纯文本，保留 # 标题标记）。
 */
export function buildDocx(text) {
  const entries = [
    { name: '[Content_Types].xml', data: new TextEncoder().encode(buildContentTypes()) },
    { name: '_rels/.rels', data: new TextEncoder().encode(buildRels()) },
    { name: 'word/_rels/document.xml.rels', data: new TextEncoder().encode(buildDocRels()) },
    { name: 'word/document.xml', data: new TextEncoder().encode(buildDocumentXml(text)) },
  ]
  return new Blob([makeZip(entries)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

/**
 * 触发 docx 下载。
 * @param {string} filename - 不含后缀
 * @param {string} text - 纯文本内容
 */
export function downloadDocx(filename, text) {
  const blob = buildDocx(text)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename + '.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
