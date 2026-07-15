// 词源（数据源）映射表
// ------------------------------------------------------------------
// dictionary_full.sources 数组中存放的是「完整数据表名」(src_words_xxx)。
// 前端不直接暴露表名，而是按此表映射为「二字简称」展示；
// 用户点击标签后，气泡以「数据源全称」为标题、「详细词源&用途说明」为内容。
//
// 若后续数据库新增词源表，只需在此对象追加一项即可，无需改动组件逻辑。

export const SOURCE_META = {
  src_words_etcc: {
    abbr: '计科',
    fullName: 'English-Thai Computer Corpus',
    description:
      '泰国玛希隆大学构建的英泰双语计算机领域平衡语料库，收录大量编程、软件、互联网、数码硬件类专业英泰对照术语，适合词典IT技术词条补充',
  },
  src_words_icu: {
    abbr: '国标',
    fullName: 'International Components for Unicode',
    description:
      'IBM 开源国际化字符处理标准库内置泰语基础词典，属于国际通用泰语字符规范词表，以基础虚词、介词、常用原生基础词为主，兼容性极强',
  },
  src_words_orst: {
    abbr: '皇院',
    fullName: 'Office of the Royal Society of Thailand',
    description:
      '泰国皇家学术院官方权威词库，是泰国国家级泰语文字规范审定数据源，负责泰语正字、词义定版、古泰语溯源，为本词典最具权威性的核心词源库',
  },
  src_words_th: {
    abbr: '通用',
    fullName: 'Pythainlp 内置基础泰语总词库',
    description:
      'Pythainlp原生整合基础词库，汇总泰国义务教育阶段常用词汇、生活场景口语短句、日常交际基础单词，作为基础词条兜底数据源',
  },
  src_words_thai2fit: {
    abbr: '分词',
    fullName: 'Thai2Fit Deep Learning Thai Word Segmentation',
    description:
      '朱拉隆功大学发布的深度学习泰语分词专用数据集配套词表，包含社交媒体网络新词、现代流行口语、语境高频词汇，主要用于项目内文本分词优化',
  },
  src_words_volubilis: {
    abbr: '外来',
    fullName: 'Volubilis Multilingual Etymology Lexicon',
    description:
      '欧洲开源多语种词源专项项目，核心能力是标注泰语外来词汇溯源，可区分梵语、巴利语、汉语、英语等借入语种与词汇演变历程，专门支撑词典「词源释义」模块',
  },
  src_words_wikipedia: {
    abbr: '百科',
    fullName: 'Thai Wikipedia Crawled Lexicon',
    description:
      '爬虫抓取泰文维基百科标题、正文核心词条生成词库，覆盖地理地名、历史人名、机构组织、专业学科、事件专有名词，用于扩充百科类小众词条',
  },
}

/**
 * 返回某个词源表名对应的元信息；未知表名返回 null（组件会回退显示原值）。
 * @param {string} key 完整数据表名，如 'src_words_orst'
 */
export function getSourceMeta(key) {
  if (!key || typeof key !== 'string') return null
  return SOURCE_META[key] || null
}

/** 判断某字符串是否为已知词源表名 */
export function isKnownSource(key) {
  return getSourceMeta(key) != null
}
