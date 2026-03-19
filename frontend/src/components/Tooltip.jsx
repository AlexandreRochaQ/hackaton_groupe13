import { useState } from 'react'

export default function Tooltip({ text, children, align = 'center' }) {
  const [show, setShow] = useState(false)

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'left'
      ? 'left-0'
      : 'left-1/2 -translate-x-1/2'

  const arrowClass =
    align === 'right'
      ? 'right-2'
      : align === 'left'
      ? 'left-2'
      : 'left-1/2 -translate-x-1/2'

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className={`absolute bottom-full ${alignClass} mb-1.5 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap z-50 shadow-lg`}
        >
          {text}
          <span
            className={`absolute top-full ${arrowClass} border-4 border-transparent border-t-slate-800`}
          />
        </span>
      )}
    </span>
  )
}
