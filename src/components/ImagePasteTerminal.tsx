import React, { useState } from 'react'
import { useImagePaste, ImageData } from '../hooks/useImagePaste'

interface ImagePasteTerminalProps {
  terminalId: number
  disabled: boolean
  onSendPrompt: (prompt: string, images?: ImageData[]) => void
  placeholder?: string
}

export const ImagePasteTerminal: React.FC<ImagePasteTerminalProps> = ({
  terminalId,
  disabled,
  onSendPrompt,
  placeholder = "Escribe tu prompt aquí... (Ctrl+V para pegar imágenes)"
}) => {
  const [prompt, setPrompt] = useState('')
  const [terminalImages, setTerminalImages] = useState<ImageData[]>([])

  // Configurar el hook de paste de imágenes
  useImagePaste({
    onImagePaste: (image: ImageData) => {
      setTerminalImages(prev => [...prev, image])
    },
    enabled: !disabled
  })

  const removeImage = (imageIndex: number) => {
    setTerminalImages(prev => prev.filter((_, i) => i !== imageIndex))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim() && !disabled) {
      onSendPrompt(prompt, terminalImages)
      setPrompt('')
      setTerminalImages([]) // Limpiar imágenes después de enviar
    }
  }

  return (
    <div className="space-y-2">
      {/* Mostrar imágenes pegadas */}
      {terminalImages.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-card/30 rounded">
          {terminalImages.map((image, index) => (
            <div key={index} className="relative group">
              <img 
                src={image.dataUrl} 
                alt={image.name}
                className="w-16 h-16 object-cover rounded border border-primary/30"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-white p-1 rounded-b truncate">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <span className="text-secondary">$</span>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={disabled ? "Terminal inactivo" : placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-white placeholder-muted outline-none disabled:text-muted input-dark border-0"
        />
        {terminalImages.length > 0 && (
          <span className="text-xs text-primary flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {terminalImages.length}
          </span>
        )}
        <button 
          type="submit"
          disabled={disabled || !prompt.trim()}
          className="px-3 py-1 bg-gradient-to-r from-primary to-secondary rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-white font-medium"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}