import { useEffect, useRef } from 'react'

export default function PlaceAutocomplete({ placeholder, defaultValue, onPlaceSelected }: {
  placeholder: string
  defaultValue?: string
  onPlaceSelected: (location: any, address: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cbRef = useRef(onPlaceSelected)
  cbRef.current = onPlaceSelected

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    const init = () => {
      const g = (window as any).google
      if (!g?.maps?.places || !inputRef.current) return false
      const ac = new g.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'my' },
        fields: ['geometry', 'formatted_address', 'name'],
      })
      ac.addListener('place_changed', () => {
        const p = ac.getPlace()
        if (p?.geometry) cbRef.current(p.geometry.location, p.formatted_address || p.name || '')
      })
      return true
    }
    if (!init()) {
      interval = setInterval(() => { if (init()) clearInterval(interval) }, 300)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [])

  return <input ref={inputRef} type="text" defaultValue={defaultValue} placeholder={placeholder} style={{ flex: 1 }} />
}
