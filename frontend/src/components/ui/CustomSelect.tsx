import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  chevronClassName?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  dropdownClassName,
  chevronClassName
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-bold hover:border-[#005b9a] focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] transition-all cursor-pointer text-left shadow-xs",
          className
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn(
          "absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 transition-transform duration-200 pointer-events-none",
          isOpen && "transform rotate-180",
          chevronClassName
        )} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute left-0 right-0 mt-1.5 min-w-[160px] bg-white border border-slate-200/80 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto",
          dropdownClassName
        )}>
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer",
                  isSelected ? "text-[#005b9a] bg-[#e6f0f7]/40 hover:bg-[#e6f0f7]/60" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#005b9a] shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
