import './App.css'
import { useEffect, useState, useRef } from 'react'

// Backend base URL: use env if provided, else default to current host:8000
const API_BASE = (typeof window !== 'undefined')
  ? (import.meta?.env?.VITE_API_URL || `http://${window.location.hostname}:8000`)
  : 'http://localhost:8000'

export default function App() {
  const [page, setPage] = useState('home') // 'home' | 'chat' | 'photo' | 'heart' | 'my'
  const [message, setMessage] = useState('')
  const [devKeyboardVisible, setDevKeyboardVisible] = useState(false)
  const [messages, setMessages] = useState([])
  const inputRef = useRef(null)
  const chatHeaderRef = useRef(null)
  const chat2Ref = useRef(null)
  const chatInputRef = useRef(null)
  const audioRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [showCamHitbox, setShowCamHitbox] = useState(false)
  const [showHeartHitbox, setShowHeartHitbox] = useState(false)
  const [showMyHitbox, setShowMyHitbox] = useState(false)
  const [showHomeHitbox, setShowHomeHitbox] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const photoHeaderRef = useRef(null)
  const [photoHeaderH, setPhotoHeaderH] = useState(0)
  const [selectedCells, setSelectedCells] = useState(new Set())
  const photoCameraRef = useRef(null)
  const heartHeaderRef = useRef(null)
  const [heartHeaderH, setHeartHeaderH] = useState(0)
  const myHeaderRef = useRef(null)
  const [myHeaderH, setMyHeaderH] = useState(0)
  const [my3Alt, setMy3Alt] = useState(false)
  const [chatHeaderH, setChatHeaderH] = useState(0)
  const [chat2H, setChat2H] = useState(0)
  const [chatInputH, setChatInputH] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [chat2Blink, setChat2Blink] = useState(false)

  const goToChat = () => {
    setPage('chat')
  }

  useEffect(() => {
    // no auto-focus on chat mount; keyboard shows only when the input is tapped
    if (page === 'chat') {
      const measure = () => {
        if (chatHeaderRef.current) setChatHeaderH(chatHeaderRef.current.offsetHeight)
        if (chat2Ref.current) setChat2H(chat2Ref.current.offsetHeight)
        if (chatInputRef.current) setChatInputH(chatInputRef.current.offsetHeight)
      }
      measure()
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
  }, [page])

  useEffect(() => {
    if (page !== 'chat') return
    const scroller = document.getElementById('chat-scroll')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [messages, page])

  // 카메라 히트영역을 항상 표시 (요청에 따라 자동 숨김 제거)

  // Leave chat: stop any playing TTS audio
  useEffect(() => {
    if (page !== 'chat' && audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsSpeaking(false)
      } catch {}
    }
  }, [page])

  // Blink chat_2 header while speaking
  useEffect(() => {
    let intervalId
    if (isSpeaking) {
      intervalId = setInterval(() => {
        setChat2Blink((v) => !v)
      }, 500)
    } else {
      setChat2Blink(false)
    }
    return () => { if (intervalId) clearInterval(intervalId) }
  }, [isSpeaking])

  // Measure photo header height when on photo page
  useEffect(() => {
    if (page !== 'photo') return
    const measure = () => {
      if (photoHeaderRef.current) setPhotoHeaderH(photoHeaderRef.current.offsetHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [page])

  // Measure heart header height when on heart page
  useEffect(() => {
    if (page !== 'heart') return
    const measure = () => {
      if (heartHeaderRef.current) setHeartHeaderH(heartHeaderRef.current.offsetHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [page])

  // Measure my header height when on my page
  useEffect(() => {
    if (page !== 'my') return
    const measure = () => {
      if (myHeaderRef.current) setMyHeaderH(myHeaderRef.current.offsetHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [page])

  // 처음 Chat 입장 시 하모가 먼저 인사
  useEffect(() => {
    if (page !== 'chat') return
    if (messages.length > 0) return
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: '하모, 먼저 인사해줘', sessionId: 'local' })
        })
        const data = await res.json()
        const content = data?.reply || '(응답이 없어요)'
        setMessages((prev) => [...prev, { role: 'assistant', content }])
        // TTS 재생
        speak(content)
      } catch {}
    })()
  }, [page])

  // 서버 TTS 호출 및 재생
  async function speak(text) {
    try {
      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'ko-girl' })
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (!audioRef.current) audioRef.current = new Audio()
      const a = audioRef.current
      // Reset previous handlers
      a.onended = null
      a.onpause = null
      a.onerror = null
      a.src = url
      a.playbackRate = 1.06
      setIsSpeaking(true)
      a.onended = () => setIsSpeaking(false)
      a.onpause = () => { if (a.currentTime === 0 || a.currentTime >= (a.duration || 0)) setIsSpeaking(false) }
      a.onerror = () => setIsSpeaking(false)
      a.currentTime = 0
      await a.play().catch(() => { setIsSpeaking(false) })
    } catch {}
  }
  useEffect(() => {
    if (page !== 'home') return
    let cancelled = false
    const initMap = () => {
      const container = document.getElementById('map-jinjuseong')
      if (!container) return
      // Reset container to avoid duplicate canvas when remounting
      container.innerHTML = ''
      window.kakao.maps.load(() => {
        if (cancelled) return
        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(35.1938, 128.0849),
          level: 3,
        })
        const geocoder = new window.kakao.maps.services.Geocoder()
        const address = '경상남도 진주시 남강로 626'
        const openMarker = (position) => {
          map.setCenter(position)
          const marker = new window.kakao.maps.Marker({ position })
          marker.setMap(map)
        }
        geocoder.addressSearch(address, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result && result.length) {
            const y = parseFloat(result[0].y)
            const x = parseFloat(result[0].x)
            openMarker(new window.kakao.maps.LatLng(y, x))
          } else {
            const places = new window.kakao.maps.services.Places()
            places.keywordSearch('진주성 촉석문', (data, status2) => {
              if (status2 === window.kakao.maps.services.Status.OK && data && data.length) {
                const y = parseFloat(data[0].y)
                const x = parseFloat(data[0].x)
                openMarker(new window.kakao.maps.LatLng(y, x))
              }
            })
          }
        })
      })
    }

    const waitForKakao = (attempt = 0) => {
      const ready = typeof window !== 'undefined' && window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function'
      if (ready) {
        initMap()
      } else if (attempt < 50) {
        setTimeout(() => waitForKakao(attempt + 1), 100)
      }
    }
    waitForKakao()
    return () => { cancelled = true }
  }, [page])
  return (
    <div className="relative min-h-dvh w-dvw bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {page === 'home' ? (
        <>
          <main className="p-0">
            <img src="/home_1.png" alt="Luma Talk header" className="block w-full" style={{ marginTop: '24px' }} />
            <img
              src="/home_2.png"
              alt="Luma Talk section"
              className="block w-full cursor-pointer"
              onClick={goToChat}
            />
            <img
              src="/home_3.png"
              alt="Luma Talk section 2"
              className="block"
              style={{ margin: '24px', width: 'calc(100% - 48px)', height: 'auto' }}
            />
            {/* Horizontally scrollable banner with fixed height */}
            <div
              className="my-4"
              style={{ 
                width: 'calc(100vw - 48px)',
                height: '180px',
                overflowX: 'auto', 
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch', 
                touchAction: 'pan-x', 
                overscrollBehaviorX: 'contain',
                margin: '24px'
              }}
              aria-label="Horizontal scroll for home_4"
            >
              <img
                src="/home_4.png"
                alt="Luma Talk horizontal section"
                style={{ height: '180px', width: 'auto', maxWidth: 'none', display: 'block' }}
              />
            </div>
            <img
              src="/home_5.png"
              alt="Luma Talk section 3"
              className="block"
              style={{ margin: '24px', width: 'calc(100% - 48px)', height: 'auto' }}
            />
            <img
              src="/home_6.png"
              alt="Luma Talk section 4"
              className="block"
              style={{ margin: '24px', marginTop: '48px', width: 'calc(100% - 48px)', height: 'auto' }}
            />
            {/* Horizontally scrollable banner (same as home_4) */}
            <div
              className="my-4"
              style={{ 
                width: 'calc(100vw - 48px)',
                height: '100px',
                overflowX: 'auto', 
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch', 
                touchAction: 'pan-x', 
                overscrollBehaviorX: 'contain',
                margin: '24px'
              }}
              aria-label="Horizontal scroll for home_7"
            >
              <img
                src="/home_7.png"
                alt="Luma Talk horizontal section 2"
                style={{ height: '100px', width: 'auto', maxWidth: 'none', display: 'block' }}
              />
            </div>
            <img
              src="/home_8.png"
              alt="Luma Talk section 5"
              className="block"
              style={{ margin: '24px', marginTop: '48px', width: 'calc(100% - 48px)', height: 'auto' }}
            />

            {/* Kakao Map - Jinjuseong */}
            <div id="map-jinjuseong" style={{ margin: '24px', marginBottom: '124px', width: 'calc(100% - 48px)', height: '320px', borderRadius: '12px', overflow: 'hidden', position: 'relative', zIndex: 0 }} />
          </main>

          {/* Fixed bottom image as navigation bar (Home only) */}
          <div
            className="pointer-events-none z-[9999] m-0"
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
          >
            <img
              src="/icon_bottombar_home.png"
              alt="Home bottom navigation"
              style={{ display: 'block', width: '100vw', maxWidth: 'none', height: 'auto' }}
            />
          </div>
          <button
            aria-label="Open chat"
            onClick={goToChat}
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: '40px',
              width: '60px',
              height: '60px',
              borderRadius: '9999px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
          {/* Home trigger over the home icon area (mirrored from person) */}
          <button
            aria-label="Go home"
            onClick={() => setPage('home')}
            style={{
              position: 'fixed',
              left: 'calc(12vw - 34px)', // mirrored position for home icon
              bottom: '0px',
              width: '68px',
              height: '68px',
              borderRadius: '9999px',
              background: showHomeHitbox ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              border: showHomeHitbox ? '2px dashed rgba(59, 130, 246, 0.9)' : 'none',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
          {/* Heart trigger over the heart icon area (mirrored from camera) */}
          <button
            aria-label="Open heart page"
            onClick={() => setPage('heart')}
            style={{
              position: 'fixed',
              left: 'calc(68.5vw - 34px)', // approximate mirrored position over heart icon
              bottom: '0px',
              width: '68px',
              height: '68px',
              borderRadius: '9999px',
              background: showHeartHitbox ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              border: showHeartHitbox ? '2px dashed rgba(59, 130, 246, 0.9)' : 'none',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
          {/* My trigger over the person icon at right end */}
          <button
            aria-label="Open my page"
            onClick={() => setPage('my')}
            style={{
              position: 'fixed',
              left: 'calc(88vw - 44px)', // shifted slightly left (~10px)
              bottom: '0px',
              width: '68px',
              height: '68px',
              borderRadius: '9999px',
              background: showMyHitbox ? 'transparent' : 'transparent',
              border: showMyHitbox ? 'none' : 'none',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
          {/* Camera trigger over the camera icon area */}
          <button
            aria-label="Open camera"
            onClick={() => setPage('photo')}
            style={{
              position: 'fixed',
              left: 'calc(31.5vw - 34px)', // slight move right
              bottom: '0px',
              width: '68px',
              height: '68px',
              borderRadius: '9999px',
              background: showCamHitbox ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              border: showCamHitbox ? '2px dashed rgba(59, 130, 246, 0.9)' : 'none',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
          {/* Hidden input to invoke iOS camera reliably */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0]
              if (file) {
                const url = URL.createObjectURL(file)
                setPhotoUrl(url)
                setPage('photo')
              }
            }}
          />
        </>
      ) : page === 'chat' ? (
        <>
          <main className="p-0" style={{ paddingBottom: 0 }}>
            {/* Fixed chat header */}
            <div
              ref={chatHeaderRef}
              id="chat-header-fixed"
              style={{ position: 'fixed', left: 0, right: 0, top: '24px', zIndex: 5, background: '#ffffff' }}
            >
              <img
                src="/chat_1.png"
                alt="Chat header"
                className="block w-full"
                onClick={() => setPage('home')}
                onLoad={() => chatHeaderRef.current && setChatHeaderH(chatHeaderRef.current.offsetHeight)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              />
            </div>
            {/* Fixed chat_2 below header, aligned left */}
            <div
              ref={chat2Ref}
              style={{ position: 'fixed', left: 0, top: `${24 + chatHeaderH}px`, zIndex: 4, background: '#ffffff' }}
            >
              <img
                src={isSpeaking ? (chat2Blink ? "/chat_2_1.png" : "/chat_2_2.png") : "/chat_2.png"}
                alt="Chat secondary"
                style={{ display: 'block', height: 'auto', maxWidth: '100%' }}
                onLoad={() => chat2Ref.current && setChat2H(chat2Ref.current.offsetHeight)}
              />
            </div>
            {/* Scroll-only area between fixed header(1,2) and fixed input */}
            <div
              id="chat-scroll"
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                top: `${24 + chatHeaderH + chat2H}px`,
                bottom: `${chatInputH}px`,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                background: '#ffffff',
              }}
            >
              <div style={{ margin: '0 18px', fontSize: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ width: '100%', display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'inline-block', padding: '10px 14px', borderRadius: '24px', background: m.role === 'user' ? '#dbeafe' : '#f3f4f6', color: '#111827', maxWidth: '80%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', alignSelf: 'center' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
          {/* Desktop-only debug keyboard overlay to emulate mobile OSK */}
          {(() => {
            const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0)
            return (!isTouch && devKeyboardVisible) ? (
              <div
                style={{
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '300px',
                  background: 'rgba(0,0,0,0.06)',
                  backdropFilter: 'blur(2px)',
                  borderTop: '1px solid #e5e7eb',
                  zIndex: 9997,
                }}
              />
            ) : null
          })()}
          {/* Bottom-fixed chat input (keyboard) */}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const text = message.trim()
              if (!text) return
              setMessages((prev) => [...prev, { role: 'user', content: text }])
              setMessage('')
              try {
                const res = await fetch(`${API_BASE}/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: text, sessionId: 'local' })
                })
                const data = await res.json()
                console.log('chat response', data)
                let content = data?.reply
                if (!content) {
                  if (data?.error) {
                    content = `오류: ${data.error}`
                    if (typeof data.detail === 'string') content += `\n${data.detail.substring(0,200)}`
                  } else {
                    content = '(응답이 없어요)'
                  }
                }
                setMessages((prev) => [...prev, { role: 'assistant', content }])
                speak(content)
              } catch (err) {
                setMessages((prev) => [...prev, { role: 'assistant', content: '(에러) 서버 응답이 없습니다.' }])
              }
            }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              background: '#ffffff',
              borderTop: '1px solid #e5e7eb',
              padding: '12px 16px',
              paddingBottom: 0,
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
            ref={chatInputRef}
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요"
              ref={inputRef}
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="none"
              autoCorrect="on"
              onFocus={() => {
                const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0)
                if (!isTouch) setDevKeyboardVisible(true)
              }}
              onBlur={() => {
                const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0)
                if (!isTouch) setDevKeyboardVisible(false)
              }}
              style={{
                flex: 1,
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '10px 14px',
                outline: 'none',
                fontSize: '18px'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                padding: '10px 14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              보내기
            </button>
          </form>
        </>
      ) : page === 'photo' ? (
        // Photo page with fixed header image like chat_1
        <main className="p-0" style={{ paddingBottom: 0 }}>
          <div
            ref={photoHeaderRef}
            style={{ position: 'fixed', left: '18px', right: '18px', top: '30px', zIndex: 5, background: '#ffffff' }}
          >
            <img
              src="/photo_1.png"
              alt="Photo header"
              className="block w-full"
              onClick={() => setPage('home')}
              onLoad={() => photoHeaderRef.current && setPhotoHeaderH(photoHeaderRef.current.offsetHeight)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            />
          </div>
          <div style={{ height: `${30 + photoHeaderH}px` }} />
          {/* Scrollable area under the fixed photo header */}
          <div
            id="photo-scroll"
            style={{
              position: 'fixed',
              left: '18px',
              right: '18px',
              top: `${30 + photoHeaderH}px`,
              bottom: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: '#ffffff',
            }}
          >
            <img
              src="/photo_2.png"
              alt="Photo section"
              className="block"
              style={{ marginTop: '50px', width: '90%', marginLeft: 'auto', marginRight: 'auto' }}
            />
            <img
              src="/photo_3.png"
              alt="Photo section 2"
              className="block"
              style={{ marginTop: '40px', width: '90%', marginLeft: 'auto', marginRight: 'auto' }}
            />
            {/* 3x5 gallery grid with vertical rectangles */}
            <div
              style={{
                marginTop: '20px',
                width: '90%',
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
              }}
            >
              {(() => {
                const base = ['/ex1.png','/ex2.png','/ex3.png','/ex4.png','/ex5.png']
                const sources = photoUrl ? [photoUrl, ...base] : base
                return Array.from({ length: 15 }).map((_, i) => {
                  const selected = selectedCells.has(i)
                  const show = i < sources.length
                  const src = show ? sources[i] : null
                  return (
                    <div
                      key={`cell-${i}`}
                      onClick={() => {
                        setSelectedCells(prev => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i); else next.add(i)
                          return next
                        })
                      }}
                      style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '160%',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: '#e5e7eb',
                        cursor: 'pointer',
                        transition: 'box-shadow 120ms ease, transform 120ms ease',
                        boxShadow: selected
                          ? '0 0 0 2px #3b82f6 inset, 0 0 0 2px rgba(59,130,246,0.45), 0 0 10px rgba(59,130,246,0.55)'
                          : 'none'
                      }}
                      aria-pressed={selected}
                    >
                      {show && (
                        <img src={src} alt={i === 0 && photoUrl ? 'captured' : `ex${i + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {selected && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>
          {/* Bottom fixed image centered, independent of scrolling */}
          <div
            style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '20px', zIndex: 6, width: '22%', maxWidth: '120px', cursor: 'pointer' }}
            onClick={() => { try { photoCameraRef.current && photoCameraRef.current.click() } catch {} }}
            aria-label="Open camera from photo page"
          >
            <img src="/photo_4.png" alt="Photo bottom" className="block w-full" style={{ height: 'auto' }} />
          </div>
          {/* Hidden camera input for photo page */}
          <input
            ref={photoCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0]
              if (file) {
                const url = URL.createObjectURL(file)
                setPhotoUrl(url)
                setPage('photo')
              }
            }}
          />
        </main>
      ) : page === 'my' ? (
        // My page with fixed header and bottom nav, scrollable content in between
        <main className="p-0" style={{ paddingBottom: 0 }}>
          {/* Fixed header */}
          <div
            ref={myHeaderRef}
            style={{ position: 'fixed', left: '18px', right: '18px', top: '30px', zIndex: 5, background: '#ffffff' }}
          >
            <img
              src="/my_1.png"
              alt="My header"
              className="block w-full"
              onClick={() => setPage('home')}
              onLoad={() => myHeaderRef.current && setMyHeaderH(myHeaderRef.current.offsetHeight)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            />
          </div>
          <div style={{ height: `${30 + myHeaderH}px` }} />
          {/* Scrollable area under fixed header, above bottom nav */}
          <div
            id="my-scroll"
            style={{
              position: 'fixed',
              left: '18px',
              right: '18px',
              top: `${30 + myHeaderH}px`,
              bottom: '90px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: '#ffffff',
            }}
          >
            <img
              src="/my_2.png"
              alt="My section"
              className="block"
              style={{ marginTop: '60px', width: '90%', marginLeft: 'auto', marginRight: 'auto' }}
            />
            <img
              src={my3Alt ? '/my_3_2.png' : '/my_3_1.png'}
              alt="My section 3"
              className="block"
              onClick={() => setMy3Alt((v) => !v)}
              style={{ marginTop: '40px', width: '95%', marginLeft: 'auto', marginRight: 'auto', cursor: 'pointer', userSelect: 'none' }}
            />
            <img
              src="/my_4.png"
              alt="My section 4"
              className="block"
              onClick={() => setPage('heart')}
              style={{ marginTop: '40px', width: '90%', marginLeft: 'auto', marginRight: 'auto', cursor: 'pointer', userSelect: 'none' }}
            />
            <img
              src="/my_5.png"
              alt="My section 5"
              className="block"
              onClick={() => setPage('photo')}
              style={{ marginTop: '50px', width: '90%', marginLeft: 'auto', marginRight: 'auto', cursor: 'pointer', userSelect: 'none' }}
            />
            {/* Horizontally scrollable banner like home_7 */}
            <div
              className="my-4"
              style={{ 
                width: 'calc(100vw - 48px)',
                height: '100px',
                overflowX: 'auto', 
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch', 
                touchAction: 'pan-x', 
                overscrollBehaviorX: 'contain',
                margin: '24px'
              }}
              aria-label="Horizontal scroll for my_6"
            >
              <img
                src="/my_6.png"
                alt="My horizontal section"
                onClick={() => setPage('photo')}
                style={{ height: '100px', width: 'auto', maxWidth: 'none', display: 'block', cursor: 'pointer', userSelect: 'none' }}
              />
            </div>
          </div>
          {/* Bottom fixed navigation image for my page */}
          <div
            className="pointer-events-none z-[9999] m-0"
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
          >
            <img
              src="/icon_bottombar_my.png"
              alt="My bottom navigation"
              style={{ display: 'block', width: '100vw', maxWidth: 'none', height: 'auto' }}
            />
          </div>
          {/* Click hit areas on my bottom nav */}
          <button aria-label="Go home" onClick={() => setPage('home')} style={{ position: 'fixed', left: 'calc(12vw - 34px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open photo" onClick={() => setPage('photo')} style={{ position: 'fixed', left: 'calc(31.5vw - 34px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open chat" onClick={goToChat} style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '40px', width: '60px', height: '60px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open heart" onClick={() => setPage('heart')} style={{ position: 'fixed', left: 'calc(68.5vw - 34px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open my" onClick={() => setPage('my')} style={{ position: 'fixed', left: 'calc(88vw - 44px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
        </main>
      ) : (
        // Heart page with fixed header image
        <main className="p-0" style={{ paddingBottom: 0 }}>
          <div
            ref={heartHeaderRef}
            style={{ position: 'fixed', left: '18px', right: '18px', top: '30px', zIndex: 5, background: '#ffffff' }}
          >
            <img
              src="/heart_1.png"
              alt="Heart header"
              className="block w-full"
              onClick={() => setPage('home')}
              onLoad={() => heartHeaderRef.current && setHeartHeaderH(heartHeaderRef.current.offsetHeight)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            />
          </div>
          <div style={{ height: `${30 + heartHeaderH}px` }} />
          {/* Scrollable area under heart header */}
          <div
            id="heart-scroll"
            style={{
              position: 'fixed',
              left: '18px',
              right: '18px',
              top: `${30 + heartHeaderH}px`,
              bottom: '90px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: '#ffffff',
            }}
          >
            <img src="/heart_2.png" alt="Heart section" className="block" style={{ marginTop: '60px', width: '90%', marginLeft: 'auto', marginRight: 'auto', cursor: 'pointer', userSelect: 'none' }} onClick={() => setPage('chat')} />
            <img src="/heart_3.png" alt="Heart section 2" className="block" style={{ marginTop: '30px', width: '95%', marginLeft: 'auto', marginRight: 'auto', cursor: 'pointer', userSelect: 'none' }} onClick={() => setPage('chat')} />
          </div>
          {/* Bottom fixed navigation image for heart page */}
          <div
            className="pointer-events-none z-[9999] m-0"
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
          >
            <img
              src="/icon_bottombar_heart.png"
              alt="Heart bottom navigation"
              style={{ display: 'block', width: '100vw', maxWidth: 'none', height: 'auto' }}
            />
          </div>
          {/* Click hit areas on heart bottom nav */}
          <button aria-label="Go home" onClick={() => setPage('home')} style={{ position: 'fixed', left: 'calc(12vw - 34px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open photo" onClick={() => setPage('photo')} style={{ position: 'fixed', left: 'calc(31.5vw - 34px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open chat" onClick={goToChat} style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '40px', width: '60px', height: '60px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open heart" onClick={() => setPage('heart')} style={{ position: 'fixed', left: 'calc(68.5vw - 34px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
          <button aria-label="Open my" onClick={() => setPage('my')} style={{ position: 'fixed', left: 'calc(88vw - 44px)', bottom: 0, width: '68px', height: '68px', borderRadius: '9999px', background: 'transparent', border: 'none', zIndex: 10000 }} />
        </main>
      )}
    </div>
  )
}


