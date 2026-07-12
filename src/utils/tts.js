// 泰语 TTS 封装（Web Speech API）。降级：不支持时静默失败。
let cachedVoice = null

function getThaiVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  cachedVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('th')) || null
  return cachedVoice
}

// 预热 voice 列表（部分浏览器异步加载）
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    getThaiVoice()
  }
}

export function speak(text, { rate = 1.0, lang = 'th-TH' } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return false
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    const v = getThaiVoice()
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
    return true
  } catch (e) {
    console.error('[tts]', e)
    return false
  }
}

export function stopSpeak() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
}
