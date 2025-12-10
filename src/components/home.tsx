import React, { useState, useRef, useEffect } from 'react'
import { Upload, Copy, Check, Image, AlertCircle, FileText, Lock, Unlock } from 'lucide-react'

export default function Home() {
  const [processedHtml, setProcessedHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [logoWidth, setLogoWidth] = useState<number>(160)
  const [logoHeight, setLogoHeight] = useState<number>(0)
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true)
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number>(1)
  const [textColor, setTextColor] = useState<string>('')
  const [separatorColor, setSeparatorColor] = useState<string>('')
  const [links, setLinks] = useState<Array<{ text: string; url: string; index: number }>>([])
  const previewRef = useRef<HTMLDivElement>(null)
  const pasteAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pasteAreaRef.current) {
      pasteAreaRef.current.focus()
    }
  }, [])

  // Reprocessa HTML quando a cor da BARRA mudar (cor de texto é aplicada manualmente)
  useEffect(() => {
    if (separatorColor && pasteAreaRef.current && pasteAreaRef.current.innerHTML && pasteAreaRef.current.innerHTML !== '<span class="text-gray-400 select-none">Cole sua assinatura aqui (Ctrl+V)...</span>') {
      const currentContent = pasteAreaRef.current.innerHTML
      processHtml(currentContent, undefined, separatorColor)
    }
  }, [separatorColor])

  const processHtml = (html: string, customTextColor?: string, customSeparatorColor?: string) => {
    try {
      setError('')
      
      // Valida se o HTML não está vazio
      if (!html || html.trim() === '') {
        setError('Por favor, cole o HTML da assinatura.')
        return ''
      }
      
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
      // Verifica se houve erro no parsing
      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        setError('HTML inválido. Certifique-se de colar HTML válido ou uma tabela do Word/LibreOffice.')
        return ''
      }
      
      // Verifica se há conteúdo no body
      if (!doc.body || !doc.body.innerHTML || doc.body.innerHTML.trim() === '') {
        setError('Nenhum conteúdo encontrado. Cole uma tabela HTML ou do Word/LibreOffice.')
        return ''
      }

      // PASSO 0: SALVA valores originais ANTES de qualquer processamento
      // Salva padding e width das células de tabela
      const allCells = doc.querySelectorAll('td')
      allCells.forEach(cell => {
        const cellElement = cell as HTMLTableCellElement
        if (cellElement.style.paddingRight) {
          cellElement.setAttribute('data-original-padding-right', cellElement.style.paddingRight)
        }
        if (cellElement.style.paddingLeft) {
          cellElement.setAttribute('data-original-padding-left', cellElement.style.paddingLeft)
        }
        if (cellElement.style.width) {
          cellElement.setAttribute('data-original-width', cellElement.style.width)
        }
      })

      // Salva margin dos links (ícones sociais)
      const allLinks = doc.querySelectorAll('a')
      allLinks.forEach(link => {
        const linkElement = link as HTMLAnchorElement
        if (linkElement.style.marginRight) {
          linkElement.setAttribute('data-original-margin-right', linkElement.style.marginRight)
        }
      })

      // Remove links de tracking e "created with" mas mantém outros links
      const links = doc.querySelectorAll('a')
      links.forEach(link => {
        const href = link.getAttribute('href') || ''
        const text = link.textContent?.toLowerCase() || ''
        
        // Remove completamente links de tracking, mysignature.io e "created with"
        if (href.includes('mysignature.io') || 
            href.includes('signature.io') || 
            text.includes('created with') ||
            text.includes('mysignature')) {
          link.remove()
          return
        }
        
        // Para links com imagens (redes sociais), MANTÉM o link (não remove!)
        const img = link.querySelector('img')
        if (img) {
          // Adiciona atributo para identificar que é um link de rede social editável
          img.setAttribute('data-social-link', href)
          // NÃO remove o link! Mantém a estrutura <a><img></a>
          // link.parentNode?.replaceChild(img, link) // REMOVIDO - causava ícones verticais
        } else {
          // Para outros links, mantém o link mas garante que tem estilos de link
          if (!link.style.color) {
            link.style.color = '#0066cc'
          }
          if (!link.style.textDecoration) {
            link.style.textDecoration = 'underline'
          }
        }
      })

      // PRIMEIRO: FORÇA display: inline-block em TODOS os links (para ícones ficarem horizontais)
      const socialLinks = doc.querySelectorAll('a')
      socialLinks.forEach(link => {
        const linkElement = link as HTMLElement
        // FORÇA inline-block em todos os links (ícones sociais precisam disso)
        linkElement.style.display = 'inline-block'
        // PRESERVA margin-right para espaçamento entre ícones
        const hasImage = linkElement.querySelector('img')
        if (hasImage) {
          // É um link com imagem (ícone social)
          // Preserva margin-right original, ou define padrão se não existir
          if (!linkElement.style.marginRight || linkElement.style.marginRight === '0px') {
            linkElement.style.marginRight = '6px'
          }

          // BACKUP para Gmail produção: adiciona espaços invisíveis após o link
          // Gmail remove margin-right mas preserva text nodes

          // Calcula número de &nbsp; baseado no margin-right ORIGINAL salvo
          const originalMargin = linkElement.getAttribute('data-original-margin-right')
          const marginRight = originalMargin || linkElement.style.marginRight

          if (marginRight && marginRight.includes('px')) {
            const marginValue = parseInt(marginRight)
            // Calibração baseada em testes: 4 espaços = demasiado, queremos ~6px
            // Vamos tentar: 1 &nbsp; ≈ 2.5px em Gmail produção
            // Para 6px: 6 / 2.5 = 2.4 → arredonda para 2 espaços
            const numSpaces = Math.max(1, Math.round(marginValue / 2.5))

            // Adiciona espaços após o link (Gmail produção preserva isto)
            const spaceString = '\u00A0'.repeat(numSpaces)
            const space = doc.createTextNode(spaceString)
            linkElement.parentNode?.insertBefore(space, linkElement.nextSibling)
          }
        }
      })

      // DEPOIS: Processa imagens (agora os links já têm display:inline-block aplicado)
      const images = doc.querySelectorAll('img')
      images.forEach((img, index) => {
        img.setAttribute('data-image-id', `img-${index}`)
        
        // Para o logo (primeira imagem), preserva dimensões exatas
        if (index === 0) {
          // Usa onload para obter dimensões naturais da imagem
          const imgElement = img as HTMLImageElement
          
          // Tenta obter dimensões de várias fontes
          const widthAttr = img.getAttribute('width')
          const heightAttr = img.getAttribute('height')
          const styleWidth = img.style.width
          const styleHeight = img.style.height
          
          let width = widthAttr ? parseInt(widthAttr) : (styleWidth ? parseInt(styleWidth) : 0)
          let height = heightAttr ? parseInt(heightAttr) : (styleHeight && styleHeight !== 'auto' ? parseInt(styleHeight) : 0)

          // Verifica se height é auto no style original
          const hasAutoHeight = styleHeight === 'auto' || (!heightAttr && !styleHeight)

          // Se não tiver dimensões, tenta obter da imagem carregada
          if ((!width || !height) && imgElement.complete && imgElement.naturalWidth) {
            width = imgElement.naturalWidth
            height = imgElement.naturalHeight
          }

          // Fallback para dimensões padrão
          if (!width) width = 160
          // Se height era auto, mantém 0 para indicar que deve ser auto
          if (!height && !hasAutoHeight && width) {
            height = Math.round(width * 0.5) // Apenas se não era auto
          }

          // Calcula e guarda aspect ratio original
          if (width && height) {
            const ratio = width / height
            setOriginalAspectRatio(ratio)
          }

          // Define dimensões iniciais no estado
          setLogoWidth(width)
          setLogoHeight(height || 0)

          // Aplica dimensões
          img.setAttribute('width', String(width))
          if (height && !hasAutoHeight) {
            img.setAttribute('height', String(height))
          }
          img.style.width = `${width}px`
          if (hasAutoHeight) {
            img.style.height = 'auto'
          } else if (height) {
            img.style.height = `${height}px`
          }
          img.style.objectFit = 'contain'
          img.style.display = 'block'
          
          // Encontra a célula da tabela que contém o logo
          let parentCell = img.parentElement
          while (parentCell && parentCell.tagName !== 'TD') {
            parentCell = parentCell.parentElement
          }
          
          if (parentCell) {
            // NÃO define width fixo na célula - deixa crescer com logo + padding
            // PRESERVA padding original se existir (não força a zero!)
            const parentCellElement = parentCell as HTMLElement
            if (!parentCellElement.style.paddingRight) {
              parentCellElement.style.paddingRight = '0'
            }
            if (!parentCellElement.style.paddingLeft) {
              parentCellElement.style.paddingLeft = '0'
            }
            if (!parentCellElement.style.paddingTop) {
              parentCellElement.style.paddingTop = '0'
            }
            if (!parentCellElement.style.paddingBottom) {
              parentCellElement.style.paddingBottom = '0'
            }
            parentCellElement.style.verticalAlign = 'top'
            parentCellElement.setAttribute('valign', 'top')
          }
        } else {
          // Para outras imagens (ícones sociais), mantém dimensões originais
          const width = img.getAttribute('width') || img.style.width
          const height = img.getAttribute('height') || img.style.height

          if (width) {
            img.setAttribute('width', width.replace('px', ''))
            img.style.width = width.includes('px') ? width : `${width}px`
          }
          if (height) {
            img.setAttribute('height', height.replace('px', ''))
            img.style.height = height.includes('px') ? height : `${height}px`
          }

          // Ícones sociais devem ser inline ou inline-block (NUNCA block)
          // Verifica se está dentro de um link <a> com display:inline-block
          const parentLink = img.closest('a')
          if (parentLink) {
            const linkStyle = (parentLink as HTMLElement).style
            if (linkStyle.display === 'inline-block') {
              // Link é inline-block, garante que imagem também é inline ou inline-block
              img.style.display = 'inline-block'
              img.style.verticalAlign = 'middle' // Alinha verticalmente
            }
          }
        }
        
        // Remove max-width que pode interferir
        img.style.maxWidth = 'none'
      })

      // Preserva margin-top/margin-bottom/line-height em DIVs (para espaçamento)
      const divs = doc.querySelectorAll('div')
      divs.forEach(div => {
        const divElement = div as HTMLElement
        // Preserva margins explícitos
        if (divElement.style.marginTop) {
          divElement.style.marginTop = divElement.style.marginTop
        }
        if (divElement.style.marginBottom) {
          divElement.style.marginBottom = divElement.style.marginBottom
        }
        // Preserva line-height explícito (importante para texto não ficar colado)
        if (divElement.style.lineHeight) {
          divElement.style.lineHeight = divElement.style.lineHeight
        }

        // BACKUP para Gmail produção: adiciona <br> após cada DIV com texto
        // Gmail remove line-height mas preserva <br> tags
        const hasText = divElement.textContent?.trim()
        const nextSibling = divElement.nextElementSibling
        const isLastDiv = !nextSibling || nextSibling.tagName !== 'DIV'

        if (hasText && !isLastDiv) {
          // Adiciona <br> invisível para forçar espaçamento vertical
          const br = doc.createElement('br')
          divElement.appendChild(br)
        }
      })

      // Preserva formatação de texto (bold, line-height, etc) e garante compatibilidade Gmail
      const allElements = doc.querySelectorAll('*')
      allElements.forEach(element => {
        const htmlElement = element as HTMLElement

        // FORÇA bold em tags <strong> e <b> (Gmail pode remover sem estilo inline)
        if (htmlElement.tagName === 'STRONG' || htmlElement.tagName === 'B') {
          htmlElement.style.fontWeight = 'bold'
        }

        // Converte font-weight bold em tag <strong> (Gmail produção preserva tags melhor que CSS)
        if (htmlElement.style.fontWeight === 'bold' || htmlElement.style.fontWeight === '700') {
          // Se é DIV ou SPAN com bold, envolve conteúdo em <strong>
          if (htmlElement.tagName === 'DIV' || htmlElement.tagName === 'SPAN') {
            const hasStrongChild = htmlElement.querySelector('strong, b')
            if (!hasStrongChild && htmlElement.textContent && htmlElement.textContent.trim()) {
              const strong = doc.createElement('strong')
              strong.style.fontWeight = 'bold'
              strong.innerHTML = htmlElement.innerHTML
              htmlElement.innerHTML = ''
              htmlElement.appendChild(strong)
            }
          }
        }

        // Preserva font-weight (bold) - usa tag <b> para máxima compatibilidade
        const computedWeight = window.getComputedStyle(element).fontWeight
        if (computedWeight === 'bold' || computedWeight === '700' || parseInt(computedWeight) >= 600) {
          htmlElement.style.fontWeight = 'bold'

          // Se não for já uma tag <b> ou <strong>, envolve o conteúdo
          if (htmlElement.tagName !== 'B' && htmlElement.tagName !== 'STRONG') {
            const textContent = htmlElement.textContent
            if (textContent && textContent.trim()) {
              const b = doc.createElement('b')
              b.style.fontWeight = 'bold'
              // Copia estilos inline
              b.style.cssText = htmlElement.style.cssText
              b.innerHTML = htmlElement.innerHTML
              htmlElement.innerHTML = ''
              htmlElement.appendChild(b)
            }
          }
        }

        // Preserva line-height com valor específico (CRÍTICO para espaçamento)
        const lineHeight = htmlElement.style.lineHeight
        if (lineHeight) {
          // FORÇA line-height com !important inline (Gmail tenta remover)
          htmlElement.style.lineHeight = lineHeight
          // Adiciona ao atributo style raw para máxima força
          const currentStyle = htmlElement.getAttribute('style') || ''
          if (!currentStyle.includes('line-height')) {
            htmlElement.setAttribute('style', currentStyle + `;line-height:${lineHeight}`)
          }
        } else if (htmlElement.tagName === 'P' || htmlElement.tagName === 'DIV') {
          // Define line-height padrão para parágrafos se não tiver
          htmlElement.style.lineHeight = '1.4'
        }

        // Garante que font-family está definido
        if (htmlElement.style.fontFamily) {
          htmlElement.style.fontFamily = htmlElement.style.fontFamily
        }

        // Garante que font-size está definido
        if (htmlElement.style.fontSize) {
          htmlElement.style.fontSize = htmlElement.style.fontSize
        }

        // Garante que color está definido
        if (htmlElement.style.color) {
          htmlElement.style.color = htmlElement.style.color
        }

        // Remove estilos problemáticos para Gmail
        htmlElement.style.removeProperty('max-width')
        htmlElement.style.removeProperty('max-height')
      })

      // Preserva bordas (linhas verticais/horizontais) - guarda info para conversão posterior
      const elementsWithBorder = doc.querySelectorAll('[style*="border"]')
      elementsWithBorder.forEach(element => {
        const style = (element as HTMLElement).style
        // Preserva informação da borda para processamento
        if (style.borderLeft) {
          (element as HTMLElement).setAttribute('data-original-border-left', style.borderLeft)
        }
        if (style.borderRight) (element as HTMLElement).style.borderRight = style.borderRight
        if (style.borderTop) (element as HTMLElement).style.borderTop = style.borderTop
        if (style.borderBottom) (element as HTMLElement).style.borderBottom = style.borderBottom
      })

      // Garante que tabelas mantêm formatação compatível com Gmail
      const tables = doc.querySelectorAll('table')
      tables.forEach(table => {
        const tableElement = table as HTMLTableElement

        // Estilos críticos para Gmail
        tableElement.style.borderCollapse = 'collapse'
        tableElement.style.borderSpacing = '0' // FORÇA espaçamento zero entre células
        tableElement.setAttribute('border', '0')
        tableElement.setAttribute('cellpadding', '0')
        tableElement.setAttribute('cellspacing', '0')
        tableElement.setAttribute('role', 'presentation')

        // CRÍTICO: Gmail REQUER tbody - sem isso a estrutura quebra!
        // Verifica se já tem tbody
        let tbody = table.querySelector('tbody')
        if (!tbody) {
          // Cria tbody e move todos os TRs para dentro dele
          tbody = doc.createElement('tbody')
          const rows = Array.from(table.querySelectorAll('tr'))
          rows.forEach(row => {
            tbody!.appendChild(row)
          })
          tableElement.appendChild(tbody)
        }

        // Preserva width se existir
        if (tableElement.style.width && tableElement.style.width !== 'auto') {
          tableElement.style.width = tableElement.style.width
        }

        // PRIMEIRO: Detecta e marca células separadoras (linha vertical com bgcolor)
        const rows = table.querySelectorAll('tr')
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'))
          cells.forEach((cell) => {
            const cellElement = cell as HTMLTableCellElement
            // Detecta célula separadora: tem bgcolor mas não tem conteúdo/imagens
            const hasBgColor = cellElement.style.backgroundColor || cellElement.getAttribute('bgcolor')
            const hasContent = cellElement.textContent?.trim() || cellElement.querySelector('img, a, div, span')
            const isVeryNarrow = cellElement.style.width && parseInt(cellElement.style.width) < 10

            if (hasBgColor && !hasContent && isVeryNarrow) {
              // É uma célula separadora - marca para não processar
              cellElement.setAttribute('data-separator-cell', 'true')

              // CRÍTICO: Adiciona conteúdo invisível com largura zero
              // Gmail produção preserva células mas pode adicionar padding/border invisível
              const cellWidth = cellElement.getAttribute('data-original-width') || cellElement.style.width || '2px'
              const widthValue = parseInt(cellWidth)

              // Usa caractere de largura zero repetido para "preencher" sem afetar visualmente
              // Isto força o Gmail a renderizar a célula mas sem adicionar espaço extra
              cellElement.innerHTML = '\u200B'.repeat(10) // Zero-width space

              // Detecta cor original do HTML e salva no state (apenas na primeira vez)
              const bgColor = cellElement.style.backgroundColor || cellElement.getAttribute('bgcolor')
              let bgColorHex = '#a9754f' // fallback

              if (bgColor) {
                if (bgColor.startsWith('#')) {
                  bgColorHex = bgColor
                } else if (bgColor.startsWith('rgb')) {
                  const match = bgColor.match(/\d+/g)
                  if (match && match.length >= 3) {
                    const r = parseInt(match[0])
                    const g = parseInt(match[1])
                    const b = parseInt(match[2])
                    bgColorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                  }
                }
              }

              // Se tem cor customizada do usuário, usa essa
              if (customSeparatorColor) {
                bgColorHex = customSeparatorColor
              } else if (!separatorColor) {
                // Salva cor original detectada no state (apenas primeira vez)
                setSeparatorColor(bgColorHex)
              }

              // Define bgcolor em AMBOS formatos
              cellElement.setAttribute('bgcolor', bgColorHex)
              cellElement.style.backgroundColor = bgColorHex

              // PRESERVA a largura original da célula separadora (barra vertical)
              // Usa cellWidth já calculado acima
              const widthPx = widthValue

              // FORÇA largura com TODOS os métodos possíveis + !important
              cellElement.style.width = cellWidth
              cellElement.style.minWidth = cellWidth
              cellElement.style.maxWidth = cellWidth
              cellElement.setAttribute('width', widthPx.toString())

              // FORÇA remoção COMPLETA de borders, paddings, margins
              cellElement.style.border = '0'
              cellElement.style.borderWidth = '0'
              cellElement.style.borderLeft = '0'
              cellElement.style.borderRight = '0'
              cellElement.style.borderTop = '0'
              cellElement.style.borderBottom = '0'
              cellElement.style.boxSizing = 'content-box' // NÃO inclui border no width

              cellElement.style.padding = '0'
              cellElement.style.paddingLeft = '0'
              cellElement.style.paddingRight = '0'
              cellElement.style.paddingTop = '0'
              cellElement.style.paddingBottom = '0'
              cellElement.style.margin = '0'
              cellElement.style.marginLeft = '0'
              cellElement.style.marginRight = '0'
              cellElement.style.lineHeight = '1px'
              cellElement.style.fontSize = '1px'

              // Adiciona !important inline diretamente no atributo style
              const currentStyle = cellElement.getAttribute('style') || ''
              cellElement.setAttribute('style', currentStyle + `;width:${cellWidth}!important;min-width:${cellWidth}!important;max-width:${cellWidth}!important`)

              // SOLUÇÃO: Criar células spacer invisíveis, usando o padding ORIGINAL das células adjacentes
              // Gmail produção remove padding CSS mas preserva células com conteúdo
              const parentRow = cellElement.parentElement

              if (parentRow) {
                const prevCell = cellElement.previousElementSibling as HTMLTableCellElement
                const nextCell = cellElement.nextElementSibling as HTMLTableCellElement

                // Extrai padding ORIGINAL da célula anterior (logo) - usa o valor SALVO
                let spacerBeforeWidth = '16px' // fallback
                if (prevCell && prevCell.tagName === 'TD') {
                  // USA o valor original salvo no início do processamento
                  const originalPadding = prevCell.getAttribute('data-original-padding-right')
                  if (originalPadding && originalPadding !== '0px') {
                    spacerBeforeWidth = originalPadding
                  } else {
                  }
                  // Remove o padding da célula original (vai ser substituído pelo spacer)
                  prevCell.style.paddingRight = '0'
                }

                // Extrai padding ORIGINAL da célula seguinte (texto) - usa o valor SALVO
                let spacerAfterWidth = '16px' // fallback
                if (nextCell && nextCell.tagName === 'TD') {
                  // USA o valor original salvo no início do processamento
                  const originalPadding = nextCell.getAttribute('data-original-padding-left')
                  if (originalPadding && originalPadding !== '0px') {
                    spacerAfterWidth = originalPadding
                  } else {
                  }
                  // Remove o padding da célula original (vai ser substituído pelo spacer)
                  nextCell.style.paddingLeft = '0'
                }

                // Cria célula spacer ANTES da barra (entre logo e barra)
                const spacerBefore = doc.createElement('td')
                spacerBefore.style.width = spacerBeforeWidth // USA o padding original!
                spacerBefore.style.minWidth = spacerBeforeWidth // FORÇA min-width para Gmail não comprimir
                spacerBefore.setAttribute('width', spacerBeforeWidth.replace('px', '')) // Atributo HTML width
                spacerBefore.style.padding = '0'
                spacerBefore.style.margin = '0'
                // Adiciona múltiplos &nbsp; proporcionais ao tamanho (1 &nbsp; ≈ 7px)
                const beforePx = parseInt(spacerBeforeWidth)
                const beforeSpaces = Math.max(1, Math.round(beforePx / 7))
                spacerBefore.innerHTML = '&nbsp;'.repeat(beforeSpaces)
                spacerBefore.setAttribute('data-spacer-cell', 'true')
                parentRow.insertBefore(spacerBefore, cellElement)

                // Cria célula spacer DEPOIS da barra (entre barra e texto)
                const spacerAfter = doc.createElement('td')
                spacerAfter.style.width = spacerAfterWidth // USA o padding original!
                spacerAfter.style.minWidth = spacerAfterWidth // FORÇA min-width para Gmail não comprimir
                spacerAfter.setAttribute('width', spacerAfterWidth.replace('px', '')) // Atributo HTML width
                spacerAfter.style.padding = '0'
                spacerAfter.style.margin = '0'
                // Adiciona múltiplos &nbsp; proporcionais ao tamanho (1 &nbsp; ≈ 7px)
                const afterPx = parseInt(spacerAfterWidth)
                const afterSpaces = Math.max(1, Math.round(afterPx / 7))
                spacerAfter.innerHTML = '&nbsp;'.repeat(afterSpaces)
                spacerAfter.setAttribute('data-spacer-cell', 'true')

                // Insere DEPOIS da célula separadora (barra vertical)
                const nextElement = cellElement.nextElementSibling
                if (nextElement) {
                  parentRow.insertBefore(spacerAfter, nextElement)
                } else {
                  parentRow.appendChild(spacerAfter)
                }
              }
            }
          })
        })

        // DEPOIS: Processa border-left nas células (mas não nas separadoras)
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'))

          cells.forEach((cell) => {
            const cellElement = cell as HTMLTableCellElement

            // NÃO processa células separadoras
            if (cellElement.getAttribute('data-separator-cell') === 'true') {
              return
            }

            const borderLeft = cellElement.style.borderLeft || cellElement.getAttribute('data-original-border-left')

            if (borderLeft && borderLeft !== 'none') {
              // Extrai cor da borda
              let borderColor = '#cccccc'
              const colorMatch = borderLeft.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/)
              if (colorMatch) {
                borderColor = colorMatch[0]
                // Converte rgb() para hex
                if (borderColor.startsWith('rgb')) {
                  const rgbMatch = borderColor.match(/\d+/g)
                  if (rgbMatch && rgbMatch.length >= 3) {
                    const r = parseInt(rgbMatch[0])
                    const g = parseInt(rgbMatch[1])
                    const b = parseInt(rgbMatch[2])
                    borderColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                  }
                }
              }

              // Extrai largura ORIGINAL da borda (não força valor)
              let borderWidth = 1 // fallback padrão
              const widthMatch = borderLeft.match(/(\d+(?:\.\d+)?)px/)
              if (widthMatch) {
                borderWidth = parseFloat(widthMatch[1])
              }

              // Detecta padding-left ORIGINAL da célula com borda
              // Este é o espaçamento DEPOIS da linha (entre linha e texto)
              let spacingAfter = 20 // fallback padrão (mysignature usa 20px)
              const paddingLeftValue = cellElement.style.paddingLeft || cellElement.getAttribute('data-original-padding-left')
              if (paddingLeftValue) {
                const paddingMatch = paddingLeftValue.match(/(\d+(?:\.\d+)?)px/)
                if (paddingMatch) {
                  spacingAfter = parseFloat(paddingMatch[1])
                }
              }

              // Detecta padding-right da célula anterior (logo)
              // Este é o espaçamento ANTES da linha (entre logo e linha)
              let spacingBefore = 20 // fallback padrão (mysignature usa 20px)
              let prevPaddingRight = ''
              const prevCell = cellElement.previousElementSibling
              if (prevCell && prevCell.tagName === 'TD') {
                prevPaddingRight = (prevCell as HTMLElement).style.paddingRight

                // Verifica também padding geral da célula anterior
                const prevPadding = (prevCell as HTMLElement).style.padding

                if (prevPaddingRight) {
                  const prevPaddingMatch = prevPaddingRight.match(/(\d+(?:\.\d+)?)px/)
                  if (prevPaddingMatch) {
                    spacingBefore = parseFloat(prevPaddingMatch[1])
                  }
                } else if (prevPadding) {
                  // Se não tem padding-right mas tem padding geral, extrai o valor
                  const prevPaddingMatch = prevPadding.match(/(\d+(?:\.\d+)?)px/)
                  if (prevPaddingMatch) {
                    spacingBefore = parseFloat(prevPaddingMatch[1])
                  }
                }
              }

              // Preserva valores originais para uso posterior
              cellElement.setAttribute('data-original-padding-left', `${spacingAfter}px`)
              cellElement.setAttribute('data-spacing-after', `${spacingAfter}px`)
              cellElement.setAttribute('data-spacing-before', `${spacingBefore}px`)

              // Preserva a borda CSS com largura original
              cellElement.style.borderLeft = `${borderWidth}px solid ${borderColor}`
              cellElement.style.borderLeftWidth = `${borderWidth}px`
              cellElement.style.borderLeftStyle = 'solid'
              cellElement.style.borderLeftColor = borderColor
              cellElement.style.paddingLeft = `${spacingAfter}px` // Espaçamento após a linha (ORIGINAL, não dividido)

              // Garante padding-right na célula anterior (logo) para espaçamento antes da linha
              if (prevCell && prevCell.tagName === 'TD') {
                // Se ainda não tem padding, adiciona; se já tem, mantém
                if (!prevPaddingRight || prevPaddingRight === '0px' || prevPaddingRight === '0') {
                  (prevCell as HTMLElement).style.paddingRight = `${spacingBefore}px`
                }
              }
            }
          })
        })

        // Processa todas as células para garantir estilos consistentes
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'))
          cells.forEach((cell) => {
            const cellElement = cell as HTMLTableCellElement

            // Preserva padding original se existir (para células sem borda)
            // NÃO define padding se célula separadora ou se já tem paddings individuais
            const isSeparator = cellElement.getAttribute('data-separator-cell') === 'true'
            const hasIndividualPadding = cellElement.style.paddingRight || cellElement.style.paddingLeft ||
                                        cellElement.style.paddingTop || cellElement.style.paddingBottom
            const originalPadding = cellElement.style.padding || cellElement.getAttribute('padding')

            if (!isSeparator && !originalPadding && !hasIndividualPadding) {
              cellElement.style.padding = '0'
            }

            // Garante que vertical-align está definido
            const verticalAlign = cellElement.style.verticalAlign || 'top'
            cellElement.style.verticalAlign = verticalAlign
            cellElement.setAttribute('valign', verticalAlign)

            cellElement.style.margin = '0'
            cellElement.style.removeProperty('display')
          })
        })
      })

      // Preserva parágrafos e line breaks
      const paragraphs = doc.querySelectorAll('p')
      paragraphs.forEach(p => {
        // PRESERVA margin/padding original se existir (importante para espaçamento)
        // Só define como '0' se NÃO tiver margin/padding definido
        const pElement = p as HTMLElement
        if (!pElement.style.margin && !pElement.style.marginTop && !pElement.style.marginBottom &&
            !pElement.style.marginLeft && !pElement.style.marginRight) {
          pElement.style.margin = '0'
        }
        if (!pElement.style.padding && !pElement.style.paddingTop && !pElement.style.paddingBottom &&
            !pElement.style.paddingLeft && !pElement.style.paddingRight) {
          pElement.style.padding = '0'
        }
      })

      const processed = doc.body.innerHTML

      // Valida se o processamento gerou conteúdo
      if (!processed || processed.trim() === '') {
        setError('Não foi possível processar o conteúdo. Tente colar novamente.')
        return ''
      }

      // Extrai todos os links editáveis (exceto ícones sociais que têm imagem)
      const extractedLinks: Array<{ text: string; url: string; index: number }> = []
      const textLinks = doc.querySelectorAll('a')
      let linkIndex = 0
      textLinks.forEach(link => {
        const hasImage = link.querySelector('img')
        if (!hasImage) {
          // É um link de texto, não um ícone
          const text = link.textContent || ''
          const url = link.getAttribute('href') || ''
          if (text && url) {
            extractedLinks.push({ text, url, index: linkIndex })
            // Adiciona um data-attribute para identificar este link
            link.setAttribute('data-link-index', linkIndex.toString())
            linkIndex++
          }
        }
      })
      setLinks(extractedLinks)

      setProcessedHtml(processed)
      return processed
    } catch (err) {
      console.error('Erro ao processar HTML:', err)
      setError('Erro ao processar HTML. Certifique-se de colar HTML válido ou uma tabela do Word/LibreOffice.')
      return ''
    }
  }

  const handlePasteArea = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Previne comportamento padrão apenas se for paste event
    if (e.type === 'paste') {
      e.preventDefault()
      
      const clipboardData = e.clipboardData || (window as any).clipboardData
      const htmlData = clipboardData.getData('text/html')
      const textData = clipboardData.getData('text/plain')
      
      if (htmlData) {
        // Limpa a área de paste
        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = htmlData
        }
        processHtml(htmlData, undefined, separatorColor)
      } else if (textData) {
        if (pasteAreaRef.current) {
          pasteAreaRef.current.textContent = textData
        }
        processHtml(textData, undefined, separatorColor)
      }
    }
  }

  const handleContentChange = () => {
    if (pasteAreaRef.current) {
      const currentContent = pasteAreaRef.current.innerHTML
      if (currentContent && currentContent !== '<span class="text-gray-400 select-none">Cole sua assinatura aqui (Ctrl+V)...</span>') {
        processHtml(currentContent, undefined, separatorColor)
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = content
        }
        processHtml(content, undefined, separatorColor)
      }
      reader.readAsText(file)
    } else {
      setError('Por favor, selecione um arquivo HTML válido (.html ou .htm).')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleImageUpload = (imageId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        
        const parser = new DOMParser()
        const doc = parser.parseFromString(processedHtml, 'text/html')
        const img = doc.querySelector(`img[data-image-id="${imageId}"]`)
        
        if (img) {
          img.setAttribute('src', base64)
          const newHtml = doc.body.innerHTML
          setProcessedHtml(newHtml)
          
          // Atualiza também a área de paste
          if (pasteAreaRef.current) {
            const pasteDoc = parser.parseFromString(pasteAreaRef.current.innerHTML, 'text/html')
            const pasteImg = pasteDoc.querySelector('img[data-image-id="' + imageId + '"]')
            if (pasteImg) {
              pasteImg.setAttribute('src', base64)
              pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML
            }
          }
        }
      }
      reader.readAsDataURL(file)
    } else {
      setError('Por favor, selecione uma imagem válida.')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleSocialLinkUpdate = (imageId: string, newLink: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(processedHtml, 'text/html')
    const img = doc.querySelector(`img[data-image-id="${imageId}"]`)
    
    if (img) {
      // Atualiza o atributo data-social-link
      img.setAttribute('data-social-link', newLink)
      
      // Envolve a imagem em um link se houver URL válida
      if (newLink && newLink.trim() !== '') {
        const link = doc.createElement('a')
        link.href = newLink
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        
        // Copia estilos da imagem para o link se necessário
        const imgParent = img.parentNode
        imgParent?.replaceChild(link, img)
        link.appendChild(img)
      }
      
      const newHtml = doc.body.innerHTML
      setProcessedHtml(newHtml)
      
      // Atualiza também a área de paste
      if (pasteAreaRef.current) {
        const pasteDoc = parser.parseFromString(pasteAreaRef.current.innerHTML, 'text/html')
        const pasteImg = pasteDoc.querySelector('img[data-image-id="' + imageId + '"]')
        if (pasteImg) {
          pasteImg.setAttribute('data-social-link', newLink)
          
          if (newLink && newLink.trim() !== '') {
            const pasteLink = pasteDoc.createElement('a')
            pasteLink.href = newLink
            pasteLink.target = '_blank'
            pasteLink.rel = 'noopener noreferrer'
            
            const pasteImgParent = pasteImg.parentNode
            pasteImgParent?.replaceChild(pasteLink, pasteImg)
            pasteLink.appendChild(pasteImg)
          }
          
          pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML
        }
      }
    }
  }

  const updateLogoSize = (width: number, height: number) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(processedHtml, 'text/html')
    const logo = doc.querySelector('img[data-image-id="img-0"]')

    if (logo) {
      logo.setAttribute('width', String(width))
      if (height > 0) {
        logo.setAttribute('height', String(height))
        ;(logo as HTMLElement).style.height = `${height}px`
      } else {
        // Se height é 0, usa auto
        logo.removeAttribute('height')
        ;(logo as HTMLElement).style.height = 'auto'
      }
      ;(logo as HTMLElement).style.width = `${width}px`
      ;(logo as HTMLElement).style.objectFit = 'contain'
      
      // Atualiza a célula da tabela que contém o logo
      let parentCell = logo.parentElement
      while (parentCell && parentCell.tagName !== 'TD') {
        parentCell = parentCell.parentElement
      }
      
      if (parentCell) {
        // Busca espaçamento detectado da célula com borda (próxima célula)
        let spacingBefore = 15 // fallback
        const nextCell = (parentCell as HTMLElement).nextElementSibling
        if (nextCell) {
          const spacingBeforeAttr = nextCell.getAttribute('data-spacing-before')
          if (spacingBeforeAttr) {
            const match = spacingBeforeAttr.match(/(\d+(?:\.\d+)?)px/)
            if (match) spacingBefore = parseFloat(match[1])
          }
        }

        // Define célula do logo SEM width fixo (deixa crescer com logo + padding)
        ;(parentCell as HTMLElement).style.removeProperty('width')
        ;(parentCell as HTMLElement).style.removeProperty('min-width')
        ;(parentCell as HTMLElement).style.removeProperty('max-width')
        ;(parentCell as HTMLElement).removeAttribute('width')
        ;(parentCell as HTMLElement).style.paddingRight = `${spacingBefore}px` // Usa valor detectado
        ;(parentCell as HTMLElement).style.paddingLeft = '0'
        ;(parentCell as HTMLElement).style.paddingTop = '0'
        ;(parentCell as HTMLElement).style.paddingBottom = '0'
        ;(parentCell as HTMLElement).style.verticalAlign = 'top'
        ;(parentCell as HTMLElement).setAttribute('valign', 'top')
      }
      
      const newHtml = doc.body.innerHTML
      setProcessedHtml(newHtml)
      
      // Atualiza também a área de paste
      if (pasteAreaRef.current) {
        const pasteDoc = parser.parseFromString(pasteAreaRef.current.innerHTML, 'text/html')
        const pasteLogo = pasteDoc.querySelector('img[data-image-id="img-0"]')
        if (pasteLogo) {
          pasteLogo.setAttribute('width', String(width))
          pasteLogo.setAttribute('height', String(height))
          ;(pasteLogo as HTMLElement).style.width = `${width}px`
          ;(pasteLogo as HTMLElement).style.height = `${height}px`
          ;(pasteLogo as HTMLElement).style.objectFit = 'contain'
          
          // Atualiza a célula da tabela no paste area
          let pasteParentCell = pasteLogo.parentElement
          while (pasteParentCell && pasteParentCell.tagName !== 'TD') {
            pasteParentCell = pasteParentCell.parentElement
          }
          
          if (pasteParentCell) {
            // Busca espaçamento detectado da célula com borda (próxima célula)
            let spacingBefore = 15 // fallback
            const nextCell = (pasteParentCell as HTMLElement).nextElementSibling
            if (nextCell) {
              const spacingBeforeAttr = nextCell.getAttribute('data-spacing-before')
              if (spacingBeforeAttr) {
                const match = spacingBeforeAttr.match(/(\d+(?:\.\d+)?)px/)
                if (match) spacingBefore = parseFloat(match[1])
              }
            }

            // Define célula do logo SEM width fixo (deixa crescer com logo + padding)
            ;(pasteParentCell as HTMLElement).style.removeProperty('width')
            ;(pasteParentCell as HTMLElement).style.removeProperty('min-width')
            ;(pasteParentCell as HTMLElement).style.removeProperty('max-width')
            ;(pasteParentCell as HTMLElement).removeAttribute('width')
            ;(pasteParentCell as HTMLElement).style.paddingRight = `${spacingBefore}px` // Usa valor detectado
            ;(pasteParentCell as HTMLElement).style.paddingLeft = '0'
            ;(pasteParentCell as HTMLElement).style.paddingTop = '0'
            ;(pasteParentCell as HTMLElement).style.paddingBottom = '0'
            ;(pasteParentCell as HTMLElement).style.verticalAlign = 'top'
            ;(pasteParentCell as HTMLElement).setAttribute('valign', 'top')
          }
          
          pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML
        }
      }
    }
  }

  const handleLogoWidthChange = (newWidth: number) => {
    setLogoWidth(newWidth)
    
    if (aspectRatioLocked && originalAspectRatio && originalAspectRatio > 0) {
      const newHeight = Math.round(newWidth / originalAspectRatio)
      setLogoHeight(newHeight)
      updateLogoSize(newWidth, newHeight)
    } else {
      updateLogoSize(newWidth, logoHeight)
    }
  }

  const handleLogoHeightChange = (newHeight: number) => {
    setLogoHeight(newHeight)
    
    if (aspectRatioLocked && originalAspectRatio && originalAspectRatio > 0) {
      const newWidth = Math.round(newHeight * originalAspectRatio)
      setLogoWidth(newWidth)
      updateLogoSize(newWidth, newHeight)
    } else {
      updateLogoSize(logoWidth, newHeight)
    }
  }

  const optimizeForGmail = (html: string): string => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // CRÍTICO: Converte border-left em célula separada com background
    // Gmail remove bordas CSS no composer, mas preserva background-color
    const tables = doc.querySelectorAll('table')
    tables.forEach(table => {
      const tableElement = table as HTMLTableElement

      // Força atributos essenciais para Gmail
      tableElement.setAttribute('border', '0')
      tableElement.setAttribute('cellpadding', '0')
      tableElement.setAttribute('cellspacing', '0')
      tableElement.setAttribute('role', 'presentation')

      // CRÍTICO: Gmail REQUER tbody
      let tbody = table.querySelector('tbody')
      if (!tbody) {
        tbody = doc.createElement('tbody')
        const rows = Array.from(table.querySelectorAll(':scope > tr'))
        rows.forEach(row => {
          tbody!.appendChild(row)
        })
        tableElement.appendChild(tbody)
      }

      // MANTÉM estrutura original de tabela - NÃO converte nada!
      // Se o HTML original tem célula com bgcolor, mantém
      // Se tem border-left, mantém também
      // Gmail produção parece aceitar melhor o HTML não-modificado

      // Estilos críticos inline
      tableElement.style.borderCollapse = 'collapse'
      tableElement.style.borderSpacing = '0'

      // Remove propriedades CSS que o Gmail não suporta
      tableElement.style.removeProperty('table-layout')
      tableElement.style.removeProperty('box-sizing')

      // Remove width se for auto ou 100%
      if (tableElement.style.width === 'auto' || tableElement.style.width === '100%') {
        tableElement.style.removeProperty('width')
        tableElement.removeAttribute('width')
      }
    })

    // Mantém padding original da célula do logo (não remove!)

    // Otimiza células
    const cells = doc.querySelectorAll('td')
    cells.forEach(cell => {
      const cellElement = cell as HTMLTableCellElement

      // Força vertical-align em ambos formatos (crítico!)
      const valign = cellElement.style.verticalAlign || cellElement.getAttribute('valign') || 'top'
      cellElement.style.verticalAlign = valign
      cellElement.setAttribute('valign', valign)

      // Garante que width está em atributo E style (ambos necessários)
      const width = cellElement.style.width || cellElement.getAttribute('width')
      if (width) {
        const widthValue = parseInt(width.toString().replace('px', ''))
        if (!isNaN(widthValue) && widthValue > 0) {
          cellElement.setAttribute('width', widthValue.toString())
          cellElement.style.width = `${widthValue}px`
        }
      }

      // MANTÉM border-left para Gmail (funciona tanto no editor quanto em produção)

      // Remove propriedades CSS não suportadas pelo Gmail
      cellElement.style.removeProperty('box-sizing')
      cellElement.style.removeProperty('min-width')
      cellElement.style.removeProperty('max-width')
      cellElement.style.removeProperty('min-height')
      cellElement.style.removeProperty('max-height')
      cellElement.style.removeProperty('display') // Gmail gerencia isso
    })

    // Remove display das linhas (Gmail gerencia automaticamente)
    const rows = doc.querySelectorAll('tr')
    rows.forEach(row => {
      (row as HTMLTableRowElement).style.removeProperty('display')
    })

    // Otimiza imagens
    const images = doc.querySelectorAll('img')
    images.forEach(img => {
      const imgElement = img as HTMLImageElement

      // Display block APENAS para logo (não para ícones sociais que devem ficar inline)
      // Detecta se é logo pelo data-image-id ou se está numa célula sozinha
      const isLogo = imgElement.getAttribute('data-image-id') === 'img-0'
      if (isLogo) {
        imgElement.style.display = 'block'
      } else {
        // Ícones sociais: garante inline-block se estiver dentro de link com inline-block
        const parentLink = imgElement.closest('a')
        if (parentLink && (parentLink as HTMLElement).style.display === 'inline-block') {
          imgElement.style.display = 'inline-block'
          imgElement.style.verticalAlign = 'middle'
        }
      }
      imgElement.style.border = 'none'
      imgElement.style.outline = 'none'
      imgElement.style.textDecoration = 'none'

      // Remove line-height que pode afetar espaçamento
      imgElement.style.removeProperty('line-height')

      // Garante width e height em AMBOS formatos (atributo + CSS)
      const width = imgElement.style.width || imgElement.getAttribute('width')
      const height = imgElement.style.height || imgElement.getAttribute('height')

      if (width) {
        const widthValue = parseInt(width.toString().replace('px', ''))
        if (!isNaN(widthValue)) {
          imgElement.setAttribute('width', widthValue.toString())
          imgElement.style.width = `${widthValue}px`
        }
      }

      if (height) {
        const heightValue = parseInt(height.toString().replace('px', ''))
        if (!isNaN(heightValue)) {
          imgElement.setAttribute('height', heightValue.toString())
          imgElement.style.height = `${heightValue}px`
        }
      }

      // Remove propriedades problemáticas
      imgElement.style.removeProperty('max-width')
      imgElement.style.removeProperty('max-height')
      imgElement.style.removeProperty('object-fit')
    })

    // Otimiza links
    const links = doc.querySelectorAll('a')
    links.forEach(link => {
      const linkElement = link as HTMLAnchorElement

      // FORÇA display: inline-block em TODOS os links (ícones sociais precisam ficar horizontais)
      linkElement.style.display = 'inline-block'

      // FORÇA margin-right para espaçamento entre ícones
      const hasImage = linkElement.querySelector('img')
      if (hasImage) {
        // É um link com imagem (ícone social) - garante espaçamento
        linkElement.style.marginRight = '5px'
      }

      // Garante target e rel para segurança
      if (!linkElement.getAttribute('target')) {
        linkElement.setAttribute('target', '_blank')
      }
      if (!linkElement.getAttribute('rel')) {
        linkElement.setAttribute('rel', 'noopener noreferrer')
      }
    })

    // Otimiza elementos de texto para Gmail
    const textElements = doc.querySelectorAll('p, div, span, td, b, strong, i, em')
    textElements.forEach(element => {
      const htmlElement = element as HTMLElement

      // Preserva e reforça bold
      if (htmlElement.style.fontWeight === 'bold' || htmlElement.style.fontWeight === '700' ||
          htmlElement.tagName === 'B' || htmlElement.tagName === 'STRONG') {
        htmlElement.style.fontWeight = 'bold'

        // Se não é uma tag <b>, converte para <b>
        if (htmlElement.tagName !== 'B' && htmlElement.tagName !== 'STRONG' && htmlElement.textContent) {
          const text = htmlElement.textContent.trim()
          if (text) {
            const b = doc.createElement('b')
            b.style.fontWeight = 'bold'
            b.textContent = text
            htmlElement.textContent = ''
            htmlElement.appendChild(b)
          }
        }
      }

      // Preserva font-size original ou define padrão
      if (htmlElement.style.fontSize) {
        // Mantém o font-size original
        htmlElement.style.fontSize = htmlElement.style.fontSize
      }

      // Preserva line-height original (CRÍTICO para espaçamento de texto)
      // Força em MÚLTIPLOS formatos para Gmail produção
      if (htmlElement.style.lineHeight) {
        const lineHeightValue = htmlElement.style.lineHeight
        htmlElement.style.lineHeight = lineHeightValue
        htmlElement.setAttribute('style', htmlElement.getAttribute('style') + `;line-height:${lineHeightValue} !important`)
      }

      // Para DIVs e P: força display:block + height mínimo se tem margin
      if (htmlElement.tagName === 'P' || htmlElement.tagName === 'DIV') {
        const hasMarginBottom = htmlElement.style.marginBottom && htmlElement.style.marginBottom !== '0px'
        const hasMarginTop = htmlElement.style.marginTop && htmlElement.style.marginTop !== '0px'

        if (hasMarginBottom || hasMarginTop) {
          // Força display block e height para Gmail respeitar
          htmlElement.style.display = 'block'
          // Adiciona height mínimo baseado no margin
          if (hasMarginBottom) {
            const marginValue = parseInt(htmlElement.style.marginBottom)
            if (!isNaN(marginValue) && marginValue > 0) {
              // Garante que elemento ocupa espaço
              htmlElement.style.minHeight = '1em'
            }
          }
        } else {
          // Não tem margin - define como 0
          htmlElement.style.margin = '0'
          htmlElement.style.padding = '0'
        }
      }
    })

    // Otimiza <br> - Gmail renderiza com espaçamento normal
    const breaks = doc.querySelectorAll('br')
    breaks.forEach(br => {
      const parent = br.parentElement
      if (parent && !parent.style.lineHeight) {
        parent.style.lineHeight = 'normal'
      }
    })

    // Limpa todos os elementos
    const allElements = doc.querySelectorAll('*')
    allElements.forEach(element => {
      const htmlElement = element as HTMLElement

      // Remove atributos data-* (desnecessários no email final)
      Array.from(htmlElement.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          htmlElement.removeAttribute(attr.name)
        }
      })

      // Remove classes (Gmail pode sobrescrever)
      if (htmlElement.hasAttribute('class')) {
        htmlElement.removeAttribute('class')
      }
    })

    return doc.body.innerHTML.trim()
  }

  const applyColorToSelection = () => {
    if (!previewRef.current || !textColor) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setError('Por favor, selecione o texto que deseja colorir.')
      setTimeout(() => setError(''), 3000)
      return
    }

    const range = selection.getRangeAt(0)

    // Verifica se a seleção está dentro do preview
    if (!previewRef.current.contains(range.commonAncestorContainer)) {
      setError('Por favor, selecione texto dentro da pré-visualização.')
      setTimeout(() => setError(''), 3000)
      return
    }

    // Cria um span com a cor
    const span = document.createElement('span')
    span.style.color = textColor

    try {
      // Envolve o conteúdo selecionado no span
      range.surroundContents(span)

      // Atualiza o HTML processado
      setProcessedHtml(previewRef.current.innerHTML)

      // Limpa seleção
      selection.removeAllRanges()
    } catch (error) {
      // Se falhar (seleção complexa), tenta abordagem alternativa
      try {
        const fragment = range.extractContents()
        span.appendChild(fragment)
        range.insertNode(span)

        setProcessedHtml(previewRef.current.innerHTML)
        selection.removeAllRanges()
      } catch (e) {
        setError('Não foi possível aplicar cor a esta seleção. Tente selecionar apenas texto simples.')
        setTimeout(() => setError(''), 3000)
      }
    }
  }

  const updateLink = (index: number, newUrl: string) => {
    if (!previewRef.current) return

    // Encontra o link no preview pelo data-link-index
    const linkElement = previewRef.current.querySelector(`a[data-link-index="${index}"]`) as HTMLAnchorElement
    if (linkElement) {
      linkElement.setAttribute('href', newUrl)

      // Atualiza o state dos links
      setLinks(prevLinks =>
        prevLinks.map(link =>
          link.index === index ? { ...link, url: newUrl } : link
        )
      )

      // Atualiza o HTML processado
      setProcessedHtml(previewRef.current.innerHTML)
    }
  }

  const copyToClipboard = async () => {
    try {
      if (previewRef.current && processedHtml) {
        // USA O HTML PROCESSADO DIRETO - sem otimizações que Gmail produção rejeita!
        const htmlToCopy = processedHtml

        // Usa método antigo confiável (API moderna tem problemas de compatibilidade)
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = htmlToCopy
        tempDiv.style.position = 'absolute'
        tempDiv.style.left = '-9999px'
        document.body.appendChild(tempDiv)

        const range = document.createRange()
        range.selectNodeContents(tempDiv)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)

        const successful = document.execCommand('copy')

        selection?.removeAllRanges()
        document.body.removeChild(tempDiv)

        if (successful) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('Falha ao copiar')
        }
      }
    } catch (err) {
      setError('Erro ao copiar. Tente selecionar manualmente o conteúdo da pré-visualização.')
      setTimeout(() => setError(''), 5000)
    }
  }

  const getImageButtons = () => {
    if (!processedHtml) return null

    const parser = new DOMParser()
    const doc = parser.parseFromString(processedHtml, 'text/html')
    const images = doc.querySelectorAll('img[data-image-id]')
    
    return Array.from(images).map((img, index) => {
      const imageId = img.getAttribute('data-image-id') || ''
      const altText = img.getAttribute('alt') || `Imagem ${index + 1}`
      const isLogo = altText.toLowerCase().includes('logo') || index === 0
      const socialLink = img.getAttribute('data-social-link') || ''
      const hasSocialLink = socialLink !== ''
      
      return (
        <div key={imageId} className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0">
              <img 
                src={img.getAttribute('src') || ''} 
                alt={altText}
                className="w-16 h-16 object-contain rounded border border-gray-300 bg-white"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {isLogo ? '🏢 ' : '🔗 '}{altText}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isLogo ? 'Logo da empresa' : 'Ícone/Imagem'}
              </p>
            </div>
            <label className="flex-shrink-0 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(imageId, e)}
                className="hidden"
              />
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                <Upload className="w-4 h-4" />
                Substituir
              </div>
            </label>
          </div>
          
          {hasSocialLink && (
            <div className="pl-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Link da rede social:
              </label>
              <input
                type="url"
                defaultValue={socialLink}
                onChange={(e) => handleSocialLinkUpdate(imageId, e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      )
    })
  }

  const imageButtons = getImageButtons()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              Editor de Assinatura Gmail
            </h1>
            <p className="text-gray-600">
              Cole ou carregue seu HTML, substitua imagens e copie para o Gmail
            </p>
          </div>

          {/* Como definir a assinatura no Gmail */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>📧 Como definir a assinatura no Gmail:</strong> Após copiar, vá ao Gmail → Configurações (⚙️) → Ver todas as configurações → Geral → Assinatura → Cole a assinatura copiada (Ctrl+V) → Salvar alterações
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* Coluna Esquerda - Input */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Cole o HTML ou carregue um arquivo
                </label>
                
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-input"
                />
                <button
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all cursor-pointer shadow-md font-medium mb-4"
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Carregar arquivo HTML</span>
                </button>

                <div
                  ref={pasteAreaRef}
                  onPaste={handlePasteArea}
                  onInput={handleContentChange}
                  contentEditable
                  suppressContentEditableWarning
                  className="relative w-full p-4 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-inner overflow-auto"
                  style={{ outline: 'none', height: '532px' }}
                  data-placeholder="Cole sua assinatura aqui (Ctrl+V)..."
                ></div>
              </div>

              {processedHtml && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📏 Ajustar Tamanho do Logo
                  </label>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Largura (px)
                        </label>
                        <input
                          type="number"
                          value={logoWidth}
                          onChange={(e) => handleLogoWidthChange(parseInt(e.target.value) || 0)}
                          min="10"
                          max="500"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      
                      <button
                        onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                        className={`mt-5 p-2 rounded-md transition-colors ${
                          aspectRatioLocked 
                            ? 'bg-purple-600 text-white hover:bg-purple-700' 
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        title={aspectRatioLocked ? 'Proporção travada' : 'Proporção livre'}
                      >
                        {aspectRatioLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </button>
                      
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Altura (px)
                        </label>
                        <input
                          type="number"
                          value={logoHeight}
                          onChange={(e) => handleLogoHeightChange(parseInt(e.target.value) || 0)}
                          min="10"
                          max="500"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>
                    
                    <div className="text-purple-700 bg-white/50 p-2 rounded" style={{ fontSize: '14px' }}>
                      <strong>💡 Dica:</strong> Dimensões atuais: {logoWidth}x{logoHeight}px
                      {logoWidth > 200 && <span className="text-orange-600 ml-2">⚠️ Logo pode ficar muito grande no Gmail</span>}
                    </div>
                  </div>
                </div>
              )}

              {processedHtml && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    🎨 Ajustar Cores
                  </label>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Cor do Texto
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            placeholder="#000000"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Cor da Barra
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={separatorColor}
                            onChange={(e) => setSeparatorColor(e.target.value)}
                            className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={separatorColor}
                            onChange={(e) => setSeparatorColor(e.target.value)}
                            placeholder="#a9754f"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {textColor && (
                      <button
                        onClick={applyColorToSelection}
                        className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        ✨ Aplicar Cor ao Texto Selecionado
                      </button>
                    )}

                    <div className="text-green-700 bg-white/50 p-2 rounded" style={{ fontSize: '14px' }}>
                      <strong>💡 Dica:</strong> {textColor ? 'Selecione o texto na pré-visualização e clique no botão acima para aplicar a cor' : 'A cor da barra é aplicada automaticamente'}
                    </div>
                  </div>
                </div>
              )}

              {imageButtons && imageButtons.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📸 Substituir Imagens ({imageButtons.length})
                  </label>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {imageButtons}
                  </div>
                </div>
              )}

              {links.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    🔗 Editar Links ({links.length})
                  </label>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg space-y-3">
                    {links.map((link) => (
                      <div key={link.index} className="bg-white p-3 rounded-md border border-blue-200">
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Texto: <span className="font-semibold text-gray-800">{link.text}</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            URL
                          </label>
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => updateLink(link.index, e.target.value)}
                            placeholder="https://exemplo.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="text-blue-700 bg-white/50 p-2 rounded" style={{ fontSize: '14px' }}>
                      <strong>💡 Dica:</strong> Altere os URLs dos links conforme necessário. As mudanças são aplicadas automaticamente.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna Direita - Preview */}
            <div className="lg:sticky lg:top-12 lg:self-start">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                👁️ Pré-visualização (Gmail)
              </label>

              <button
                onClick={copyToClipboard}
                disabled={!processedHtml}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg font-medium mb-4"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copiar Assinatura
                  </>
                )}
              </button>

              <div
                ref={previewRef}
                className="p-6 bg-white border-2 border-gray-300 rounded-lg shadow-inner overflow-auto"
                style={{ height: '532px' }}
              >
                {processedHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                    <Image className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">A aguardar assinatura</p>
                    <p className="text-sm mt-2">Cole sua assinatura para visualizar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
