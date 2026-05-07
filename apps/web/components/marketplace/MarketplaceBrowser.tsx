'use client'

import { useEffect, useState } from 'react'

export function MarketplaceBrowser() {
  const [plugins, setPlugins] = useState([])

  useEffect(() => {
    fetch('/api/plugins').then(res => res.json()).then(setPlugins)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {plugins.map(p => (
        <div key={p.id} className="border p-4 rounded shadow">
          <h3 className="font-bold">{p.name}</h3>
          <p>{p.description}</p>
          <button className="bg-blue-500 text-white px-4 py-2 mt-2 rounded">
            Install
          </button>
        </div>
      ))}
    </div>
  )
}
