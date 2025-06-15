import { useCallback, useEffect } from 'react'

interface ImageData {
  file: File
  dataUrl: string
  name: string
}

interface UseImagePasteOptions {
  onImagePaste: (image: ImageData) => void
  enabled?: boolean
}

export const useImagePaste = ({ onImagePaste, enabled = true }: UseImagePasteOptions) => {
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (!enabled) return
    
    const items = event.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        
        const file = item.getAsFile()
        if (!file) continue

        // Crear data URL para preview
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })

        const imageData: ImageData = {
          file,
          dataUrl,
          name: `image-${Date.now()}.${file.type.split('/')[1] || 'png'}`
        }

        onImagePaste(imageData)
        break // Solo procesar la primera imagen
      }
    }
  }, [onImagePaste, enabled])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return
    
    // Detectar Ctrl+V (o Cmd+V en Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      // El evento paste se disparará automáticamente
      return
    }
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      document.addEventListener('paste', handlePaste)
      document.addEventListener('keydown', handleKeyDown)
      
      return () => {
        document.removeEventListener('paste', handlePaste)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [handlePaste, handleKeyDown, enabled])

  return {
    handlePaste,
    handleKeyDown
  }
}

export type { ImageData }