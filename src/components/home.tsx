import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Copy,
  Check,
  Image,
  AlertCircle,
  FileText,
  Lock,
  Unlock,
  Save,
  FolderOpen,
  Trash2,
  Download,
  Edit3,
  Mail,
  Building2,
  Link2,
  Ruler,
  Palette,
  ImageIcon,
  Lightbulb,
  Info,
  ClipboardList,
  Sparkles,
  Eye,
  CheckCircle,
  Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SavedSignature {
  id: string;
  name: string;
  html: string;
  thumbnail: string;
  savedAt: string;
  logoWidth: number;
  logoHeight: number;
  textColor: string;
  separatorColor: string;
}

export default function Home() {
  const [processedHtml, setProcessedHtml] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [logoWidth, setLogoWidth] = useState<number>(160);
  const [logoHeight, setLogoHeight] = useState<number>(0);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number>(1);
  const [textColor, setTextColor] = useState<string>("");
  const [separatorColor, setSeparatorColor] = useState<string>("");
  const [links, setLinks] = useState<
    Array<{ text: string; url: string; index: number }>
  >([]);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [signatureName, setSignatureName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pasteAreaRef.current) {
      pasteAreaRef.current.focus();
    }
    // Carrega assinaturas guardadas do localStorage
    loadSavedSignatures();
  }, []);

  // Carrega assinaturas do localStorage
  const loadSavedSignatures = () => {
    try {
      const saved = localStorage.getItem("emailSignatures");
      if (saved) {
        const signatures = JSON.parse(saved) as SavedSignature[];
        setSavedSignatures(signatures);
      }
    } catch (err) {
      console.error("Erro ao carregar assinaturas:", err);
    }
  };

  // Remove cores inline do HTML para manter o original sem customizações
  const removeInlineColors = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove style.color de todos os elementos (exceto links que devem manter cor)
    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      const element = el as HTMLElement;
      // Só remove cor se NÃO for um link (links mantêm cor original)
      if (element.tagName !== "A" && element.style.color) {
        element.style.color = "";
      }
    });

    return doc.body.innerHTML;
  };

  // Guarda assinatura no localStorage
  const saveSignature = () => {
    if (!processedHtml) {
      setError("Não há assinatura para guardar.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (!signatureName.trim()) {
      setError("Por favor, dê um nome à assinatura.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    try {
      // Guarda o HTML ORIGINAL (do pasteAreaRef) para permitir edição futura
      const originalHtml = pasteAreaRef.current?.innerHTML || processedHtml;

      // Cria thumbnail usando o HTML processado para preview
      const thumbnail = processedHtml;

      const newSignature: SavedSignature = {
        id: Date.now().toString(),
        name: signatureName.trim(),
        html: originalHtml, // Guarda HTML original, não o processado
        thumbnail,
        savedAt: new Date().toISOString(),
        logoWidth,
        logoHeight,
        textColor,
        separatorColor,
      };

      const updated = [...savedSignatures, newSignature];
      setSavedSignatures(updated);
      localStorage.setItem("emailSignatures", JSON.stringify(updated));

      setSignatureName("");
      setShowSaveDialog(false);
      setError("");

      // LIMPA TODOS OS ESTADOS após guardar (para permitir carregar nova assinatura)
      setProcessedHtml("");
      if (pasteAreaRef.current) {
        pasteAreaRef.current.innerHTML = "";
      }

      // Reset de cores
      setTextColor("");
      setSeparatorColor("");

      // Reset de dimensões do logo
      setLogoWidth(0);
      setLogoHeight(0);
      setOriginalAspectRatio(1);

      // Reset dos links editáveis (limpa campos de links da UI)
      setLinks([]);

      // Mostra mensagem de sucesso
      setSuccessMessage("Assinatura guardada com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Erro ao guardar assinatura:", err);
      setError(
        "Erro ao guardar assinatura. O espaço de armazenamento pode estar cheio.",
      );
      setTimeout(() => setError(""), 5000);
    }
  };

  // Carrega uma assinatura guardada
  const loadSignature = (signature: SavedSignature) => {
    // Remove cores inline do HTML antes de colocar no pasteArea
    const cleanedHtml = removeInlineColors(signature.html);

    // Coloca o HTML limpo (sem cores customizadas inline) no pasteArea
    if (pasteAreaRef.current) {
      pasteAreaRef.current.innerHTML = cleanedHtml;
    }

    // Carrega as cores guardadas
    setLogoWidth(signature.logoWidth);
    setLogoHeight(signature.logoHeight);
    setTextColor(signature.textColor);
    setSeparatorColor(signature.separatorColor);

    // Processa o HTML limpo com as cores guardadas para mostrar no preview
    const processed = processHtml(
      cleanedHtml,
      signature.textColor,
      signature.separatorColor,
    );
    if (processed) {
      setProcessedHtml(processed);
    }
  };

  // Confirma a eliminação de uma assinatura
  const confirmDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  // Elimina uma assinatura
  const deleteSignature = () => {
    if (!deleteConfirmId) return;

    const updated = savedSignatures.filter((sig) => sig.id !== deleteConfirmId);
    setSavedSignatures(updated);
    localStorage.setItem("emailSignatures", JSON.stringify(updated));
    setDeleteConfirmId(null);
  };

  // Copia uma assinatura guardada diretamente para a área de transferência
  const copySavedSignature = async (signature: SavedSignature) => {
    try {
      const htmlToCopy = signature.html;

      // Usa método confiável para copiar HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlToCopy;
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const successful = document.execCommand("copy");

      selection?.removeAllRanges();
      document.body.removeChild(tempDiv);

      if (successful) {
        setSuccessMessage("Assinatura copiada! Cole diretamente no Gmail.");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        throw new Error("Falha ao copiar");
      }
    } catch (err) {
      setError("Erro ao copiar assinatura.");
      setTimeout(() => setError(""), 3000);
    }
  };

  // Exporta uma assinatura específica para HTML
  const exportSignatureAsHTML = (signature: SavedSignature) => {
    // Cria um HTML completo que pode ser aberto no browser
    const htmlContent = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${signature.name}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .info {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #007bff;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .signature-container {
            border: 1px solid #ddd;
            padding: 0;
            background: white;
            margin-top: 20px;
        }
        .signature-container table {
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${signature.name}</h1>

        <div class="info">
            <strong>Informação:</strong><br>
            Guardada em: ${new Date(signature.savedAt).toLocaleDateString("pt-PT")} às ${new Date(signature.savedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}<br>
            <br>
            <strong>Como usar:</strong><br>
            1. Selecione todo o conteúdo da assinatura abaixo (Ctrl+A)<br>
            2. Copie (Ctrl+C)<br>
            3. Cole no Email Signature Studio ou diretamente no Gmail
        </div>

        <div class="signature-container">
            ${signature.html}
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    // Remove caracteres especiais do nome do arquivo
    const fileName = signature.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.download = `${fileName}-${new Date().toISOString().split("T")[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Exporta todas as assinaturas para HTML (backup)
  const exportAllSignatures = () => {
    if (savedSignatures.length === 0) {
      setError("Não há assinaturas para exportar.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Gera HTML com todas as assinaturas
    const signaturesHTML = savedSignatures
      .map(
        (sig, index) => `
      <div class="signature-section">
        <h2>${index + 1}. ${sig.name}</h2>
        <div class="signature-info">
          <strong>Guardada em:</strong> ${new Date(sig.savedAt).toLocaleDateString("pt-PT")} às ${new Date(sig.savedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}<br>
          <strong>Dimensões do Logo:</strong> ${sig.logoWidth}x${sig.logoHeight}px
        </div>
        <div class="signature-container" id="signature-${index}">
          ${sig.html}
        </div>
        <button
          class="copy-button"
          onclick="copySignature(${index})"
          title="Copiar assinatura para a área de transferência">
          📋 Copiar Assinatura
        </button>
        <div class="copy-feedback" id="feedback-${index}"></div>
      </div>
    `,
      )
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backup de Assinaturas - ${new Date().toLocaleDateString("pt-PT")}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header-info {
            background: #e3f2fd;
            padding: 20px;
            border-left: 5px solid #007bff;
            margin-bottom: 30px;
            border-radius: 4px;
        }
        .signature-section {
            margin-bottom: 50px;
            padding: 25px;
            background: #fafafa;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .signature-section h2 {
            color: #1976d2;
            margin-top: 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #1976d2;
        }
        .signature-info {
            background: white;
            padding: 12px;
            margin: 15px 0;
            border-left: 4px solid #4caf50;
            font-size: 14px;
            border-radius: 4px;
        }
        .signature-container {
            border: 2px solid #ddd;
            padding: 0;
            background: white;
            margin-top: 15px;
            border-radius: 4px;
        }
        .signature-container table {
            margin: 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .instructions {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 14px;
        }
        .copy-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 15px;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s;
            box-shadow: 0 2px 5px rgba(0, 123, 255, 0.3);
        }
        .copy-button:hover {
            background: #0056b3;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 123, 255, 0.4);
        }
        .copy-button:active {
            transform: translateY(0);
        }
        .copy-feedback {
            display: inline-block;
            margin-left: 15px;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .copy-feedback.show {
            opacity: 1;
        }
        .copy-feedback.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .copy-feedback.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
    <script>
        async function copySignature(index) {
            const signatureElement = document.getElementById('signature-' + index);
            const feedbackElement = document.getElementById('feedback-' + index);
            const button = event.target;

            try {
                // Cria um range para selecionar o conteúdo
                const range = document.createRange();
                range.selectNodeContents(signatureElement);

                // Copia usando a API moderna do Clipboard
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);

                // Copia o HTML
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([signatureElement.innerHTML], { type: 'text/html' }),
                        'text/plain': new Blob([signatureElement.innerText], { type: 'text/plain' })
                    })
                ]);

                // Remove a seleção
                selection.removeAllRanges();

                // Mostra feedback de sucesso
                feedbackElement.textContent = '✓ Copiado com sucesso!';
                feedbackElement.className = 'copy-feedback success show';
                button.textContent = '✓ Copiado!';
                button.style.background = '#28a745';

                // Reset após 3 segundos
                setTimeout(() => {
                    feedbackElement.className = 'copy-feedback';
                    button.textContent = '📋 Copiar Assinatura';
                    button.style.background = '#007bff';
                }, 3000);

            } catch (err) {
                console.error('Erro ao copiar:', err);

                // Fallback: tenta copiar usando execCommand
                try {
                    const range = document.createRange();
                    range.selectNodeContents(signatureElement);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    document.execCommand('copy');
                    selection.removeAllRanges();

                    feedbackElement.textContent = '✓ Copiado!';
                    feedbackElement.className = 'copy-feedback success show';
                    setTimeout(() => {
                        feedbackElement.className = 'copy-feedback';
                    }, 3000);
                } catch (fallbackErr) {
                    feedbackElement.textContent = '✗ Erro ao copiar. Por favor, selecione e copie manualmente (Ctrl+C).';
                    feedbackElement.className = 'copy-feedback error show';
                    setTimeout(() => {
                        feedbackElement.className = 'copy-feedback';
                    }, 5000);
                }
            }
        }
    </script>
</head>
<body>
    <div class="container">
        <h1>Backup de Assinaturas de Email</h1>

        <div class="header-info">
            <strong>Informação do Backup</strong><br>
            Data de exportação: ${new Date().toLocaleDateString("pt-PT")} às ${new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}<br>
            Total de assinaturas: ${savedSignatures.length}
        </div>

        <div class="instructions">
            <strong>Como usar este backup:</strong><br>
            1. Role até à assinatura que deseja usar<br>
            2. Clique no botão <strong>"📋 Copiar Assinatura"</strong> abaixo da assinatura<br>
            3. Cole no Email Signature Studio ou diretamente no Gmail (Ctrl+V)<br>
            <br>
            <em>Nota: Se o botão não funcionar, pode selecionar manualmente todo o conteúdo da assinatura e copiar com Ctrl+C</em>
        </div>

        ${signaturesHTML}

        <div class="footer">
            <strong>Email Signature Studio</strong><br>
            Backup gerado automaticamente em ${new Date().toLocaleDateString("pt-PT")}
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-assinaturas-${new Date().toISOString().split("T")[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);

    setSuccessMessage(
      `Backup criado com ${savedSignatures.length} assinatura(s)!`,
    );
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  // Reprocessa HTML quando a cor de TEXTO mudar
  useEffect(() => {
    if (textColor && pasteAreaRef.current && pasteAreaRef.current.innerHTML) {
      const currentContent = pasteAreaRef.current.innerHTML;
      // Verifica se não é o placeholder e se tem conteúdo válido
      if (
        currentContent !==
          '<span class="text-gray-400 select-none">Edite a sua assinatura, depois de a carregar</span>' &&
        currentContent.trim() !== "" &&
        processedHtml
      ) {
        // Só reprocessa se já existe HTML processado
        const processed = processHtml(
          currentContent,
          textColor,
          separatorColor,
        );
        if (processed) {
          setProcessedHtml(processed);
        }
      }
    }
  }, [textColor]);

  // Reprocessa HTML quando a cor da BARRA mudar
  useEffect(() => {
    if (
      separatorColor &&
      pasteAreaRef.current &&
      pasteAreaRef.current.innerHTML
    ) {
      const currentContent = pasteAreaRef.current.innerHTML;
      // Verifica se não é o placeholder e se tem conteúdo válido
      if (
        currentContent !==
          '<span class="text-gray-400 select-none">Edite a sua assinatura, depois de a carregar</span>' &&
        currentContent.trim() !== "" &&
        processedHtml
      ) {
        // Só reprocessa se já existe HTML processado
        const processed = processHtml(
          currentContent,
          textColor,
          separatorColor,
        );
        if (processed) {
          setProcessedHtml(processed);
        }
      }
    }
  }, [separatorColor]);

  const processHtml = (
    html: string,
    customTextColor?: string,
    customSeparatorColor?: string,
  ) => {
    try {
      setError("");

      // Valida se o HTML não está vazio
      if (!html || html.trim() === "") {
        setError("Por favor, cole o HTML da assinatura.");
        return "";
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Verifica se houve erro no parsing
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        setError(
          "HTML inválido. Certifique-se de colar HTML válido ou uma tabela do Word/LibreOffice.",
        );
        return "";
      }

      // Verifica se há conteúdo no body
      if (
        !doc.body ||
        !doc.body.innerHTML ||
        doc.body.innerHTML.trim() === ""
      ) {
        setError(
          "Nenhum conteúdo encontrado. Cole uma tabela HTML ou do Word/LibreOffice.",
        );
        return "";
      }

      // PASSO 0: SALVA valores originais ANTES de qualquer processamento
      // Salva padding e width das células de tabela
      const allCells = doc.querySelectorAll("td");
      allCells.forEach((cell) => {
        const cellElement = cell as HTMLTableCellElement;
        if (cellElement.style.paddingRight) {
          cellElement.setAttribute(
            "data-original-padding-right",
            cellElement.style.paddingRight,
          );
        }
        if (cellElement.style.paddingLeft) {
          cellElement.setAttribute(
            "data-original-padding-left",
            cellElement.style.paddingLeft,
          );
        }
        if (cellElement.style.width) {
          cellElement.setAttribute(
            "data-original-width",
            cellElement.style.width,
          );
        }
      });

      // Salva margin dos links (ícones sociais)
      const allLinks = doc.querySelectorAll("a");
      allLinks.forEach((link) => {
        const linkElement = link as HTMLAnchorElement;
        if (linkElement.style.marginRight) {
          linkElement.setAttribute(
            "data-original-margin-right",
            linkElement.style.marginRight,
          );
        }
      });

      // Remove links de tracking e "created with" mas mantém outros links
      const links = doc.querySelectorAll("a");
      links.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const text = link.textContent?.toLowerCase() || "";

        // Remove completamente links de tracking, mysignature.io e "created with"
        if (
          href.includes("mysignature.io") ||
          href.includes("signature.io") ||
          text.includes("created with") ||
          text.includes("mysignature")
        ) {
          link.remove();
          return;
        }

        // Para links com imagens (redes sociais), MANTÉM o link (não remove!)
        const img = link.querySelector("img");
        if (img) {
          // Adiciona atributo para identificar que é um link de rede social editável
          img.setAttribute("data-social-link", href);
          // NÃO remove o link! Mantém a estrutura <a><img></a>
          // link.parentNode?.replaceChild(img, link) // REMOVIDO - causava ícones verticais
        } else {
          // Para outros links, mantém o link mas garante que tem estilos de link
          if (!link.style.color) {
            link.style.color = "#0066cc";
          }
          if (!link.style.textDecoration) {
            link.style.textDecoration = "underline";
          }
        }
      });

      // PRIMEIRO: FORÇA display: inline-block em TODOS os links (para ícones ficarem horizontais)
      const socialLinks = doc.querySelectorAll("a");
      let firstSocialLinkFound = false;
      socialLinks.forEach((link, index) => {
        const linkElement = link as HTMLElement;
        // FORÇA inline-block em todos os links (ícones sociais precisam disso)
        linkElement.style.display = "inline-block";
        // PRESERVA margin-right para espaçamento entre ícones
        const hasImage = linkElement.querySelector("img");
        if (hasImage) {
          // É um link com imagem (ícone social)

          // ADICIONA espaçamento vertical antes do PRIMEIRO ícone social
          if (!firstSocialLinkFound) {
            firstSocialLinkFound = true;

            // LIMPA elementos vazios/whitespace ANTES do primeiro ícone
            let currentNode = linkElement.previousSibling;
            const nodesToRemove: Node[] = [];

            // Percorre todos os siblings anteriores e marca vazios para remoção
            while (currentNode) {
              let shouldRemove = false;

              if (currentNode.nodeType === Node.TEXT_NODE) {
                // Remove text nodes que são só whitespace
                if (currentNode.textContent?.trim() === "") {
                  shouldRemove = true;
                }
              } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                const el = currentNode as HTMLElement;
                // Remove elementos vazios (mas preserva <br>)
                const isEmpty =
                  !el.textContent?.trim() &&
                  el.tagName !== "BR" &&
                  !el.querySelector("img") &&
                  !el.querySelector("a");
                if (isEmpty) {
                  shouldRemove = true;
                }
              }

              if (shouldRemove) {
                nodesToRemove.push(currentNode);
              }

              currentNode = currentNode.previousSibling;
            }

            // Remove os nós vazios
            nodesToRemove.forEach((node) => node.remove());

            // Adiciona um <br> antes do primeiro ícone para criar espaço vertical
            // Gmail produção preserva <br> tags
            const br = doc.createElement("br");
            linkElement.parentNode?.insertBefore(br, linkElement);
          }

          // Preserva margin-right original, ou define padrão se não existir
          if (
            !linkElement.style.marginRight ||
            linkElement.style.marginRight === "0px"
          ) {
            linkElement.style.marginRight = "6px";
          }

          // BACKUP para Gmail produção: adiciona espaços invisíveis após o link
          // Gmail remove margin-right mas preserva text nodes

          // Calcula número de &nbsp; baseado no margin-right ORIGINAL salvo
          const originalMargin = linkElement.getAttribute(
            "data-original-margin-right",
          );
          const marginRight = originalMargin || linkElement.style.marginRight;

          if (marginRight && marginRight.includes("px")) {
            const marginValue = parseInt(marginRight);
            // Calibração baseada em testes: 4 espaços = demasiado, queremos ~6px
            // Vamos tentar: 1 &nbsp; ≈ 2.5px em Gmail produção
            // Para 6px: 6 / 2.5 = 2.4 → arredonda para 2 espaços
            const numSpaces = Math.max(1, Math.round(marginValue / 2.5));

            // Adiciona espaços após o link (Gmail produção preserva isto)
            const spaceString = "\u00A0".repeat(numSpaces);
            const space = doc.createTextNode(spaceString);
            linkElement.parentNode?.insertBefore(
              space,
              linkElement.nextSibling,
            );
          }
        }
      });

      // ADICIONA <br> antes do PRIMEIRO contacto (p:, m:, e:, w:, a:)
      // Mesma solução que funciona para ícones das redes sociais
      const allTextElements = doc.querySelectorAll("div, p, span");
      let firstContactFound = false;

      allTextElements.forEach((element) => {
        const text = element.textContent?.trim() || "";

        // Detecta se é um contacto (começa com p:, m:, e:, w:, a:, t:, f:)
        const isContact = /^(p|m|e|w|a|t|f):/i.test(text);

        if (isContact && !firstContactFound) {
          firstContactFound = true;

          // LIMPA elementos vazios/whitespace ANTES do primeiro contacto
          let currentNode = element.previousSibling;
          const nodesToRemove: Node[] = [];

          // Percorre todos os siblings anteriores e marca vazios para remoção
          while (currentNode) {
            let shouldRemove = false;

            if (currentNode.nodeType === Node.TEXT_NODE) {
              // Remove text nodes que são só whitespace
              if (currentNode.textContent?.trim() === "") {
                shouldRemove = true;
              }
            } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
              const el = currentNode as HTMLElement;
              // Remove elementos vazios (mas preserva <br>, <img>, <a>)
              const isImg = el.tagName === "IMG";
              const isBr = el.tagName === "BR";
              const isLink = el.tagName === "A";
              const hasImage = el.querySelector("img") !== null;
              const hasLink = el.querySelector("a") !== null;
              const hasText = el.textContent?.trim() !== "";

              // Só remove se não tiver nada importante
              if (
                !hasText &&
                !hasImage &&
                !hasLink &&
                !isBr &&
                !isImg &&
                !isLink
              ) {
                shouldRemove = true;
              }
            }

            if (shouldRemove) {
              nodesToRemove.push(currentNode);
            }

            currentNode = currentNode.previousSibling;
          }

          // Remove os nós vazios
          nodesToRemove.forEach((node) => node.remove());

          // Adiciona um <br> antes do primeiro contacto para criar espaço vertical
          const br = doc.createElement("br");
          element.parentNode?.insertBefore(br, element);
        }
      });

      // REMOVE <br> duplicados/consecutivos (causa espaços vazios extras)
      const allBrs = doc.querySelectorAll("br");
      allBrs.forEach((br) => {
        const nextSibling = br.nextSibling;
        // Se próximo elemento também é <br>, remove um deles
        if (nextSibling && nextSibling.nodeName === "BR") {
          br.remove();
        }
      });

      // LIMPEZA AGRESSIVA: Remove elementos vazios
      // MAS NÃO remove text nodes com whitespace (podem ser espaços após p:, m:, etc.)
      const allElsToClean = doc.querySelectorAll("*");
      allElsToClean.forEach((el) => {
        const element = el as HTMLElement;

        // Remove elementos COMPLETAMENTE vazios (sem texto, sem imagens, sem links)
        const hasNoText =
          !element.textContent || element.textContent.trim() === "";
        const hasNoImages = !element.querySelector("img");
        const hasNoLinks = !element.querySelector("a");
        const isNotBr = element.tagName !== "BR";
        const isNotImg = element.tagName !== "IMG";
        const isNotTable =
          element.tagName !== "TABLE" &&
          element.tagName !== "TR" &&
          element.tagName !== "TD" &&
          element.tagName !== "TBODY";

        if (
          hasNoText &&
          hasNoImages &&
          hasNoLinks &&
          isNotBr &&
          isNotImg &&
          isNotTable
        ) {
          element.remove();
        }

        // NÃO remove text nodes com whitespace - eles podem ser espaços importantes
        // como o espaço após "p:", "m:", "w:", etc.
      });

      // DEPOIS: Processa imagens (agora os links já têm display:inline-block aplicado)
      const images = doc.querySelectorAll("img");
      images.forEach((img, index) => {
        img.setAttribute("data-image-id", `img-${index}`);

        // Para o logo (primeira imagem), preserva dimensões exatas
        if (index === 0) {
          // Usa onload para obter dimensões naturais da imagem
          const imgElement = img as HTMLImageElement;

          // Tenta obter dimensões de várias fontes
          const widthAttr = img.getAttribute("width");
          const heightAttr = img.getAttribute("height");
          const styleWidth = img.style.width;
          const styleHeight = img.style.height;

          let width = widthAttr
            ? parseInt(widthAttr)
            : styleWidth
              ? parseInt(styleWidth)
              : 0;
          let height = heightAttr
            ? parseInt(heightAttr)
            : styleHeight && styleHeight !== "auto"
              ? parseInt(styleHeight)
              : 0;

          // Verifica se height é auto no style original
          const hasAutoHeight =
            styleHeight === "auto" || (!heightAttr && !styleHeight);

          // Se não tiver dimensões, tenta obter da imagem carregada
          if (
            (!width || !height) &&
            imgElement.complete &&
            imgElement.naturalWidth
          ) {
            width = imgElement.naturalWidth;
            height = imgElement.naturalHeight;
          }

          // Fallback para dimensões padrão
          if (!width) width = 160;
          // Se height era auto, mantém 0 para indicar que deve ser auto
          if (!height && !hasAutoHeight && width) {
            height = Math.round(width * 0.5); // Apenas se não era auto
          }

          // Calcula e guarda aspect ratio original
          if (width && height) {
            const ratio = width / height;
            setOriginalAspectRatio(ratio);
          }

          // Define dimensões iniciais no estado
          setLogoWidth(width);
          setLogoHeight(height || 0);

          // Aplica dimensões
          img.setAttribute("width", String(width));
          if (height && !hasAutoHeight) {
            img.setAttribute("height", String(height));
          }
          img.style.width = `${width}px`;
          if (hasAutoHeight) {
            img.style.height = "auto";
          } else if (height) {
            img.style.height = `${height}px`;
          }
          img.style.objectFit = "contain";
          img.style.display = "block";

          // Encontra a célula da tabela que contém o logo
          let parentCell = img.parentElement;
          while (parentCell && parentCell.tagName !== "TD") {
            parentCell = parentCell.parentElement;
          }

          if (parentCell) {
            // NÃO define width fixo na célula - deixa crescer com logo + padding
            // PRESERVA padding original se existir (não força a zero!)
            const parentCellElement = parentCell as HTMLElement;
            if (!parentCellElement.style.paddingRight) {
              parentCellElement.style.paddingRight = "0";
            }
            if (!parentCellElement.style.paddingLeft) {
              parentCellElement.style.paddingLeft = "0";
            }
            if (!parentCellElement.style.paddingTop) {
              parentCellElement.style.paddingTop = "0";
            }
            if (!parentCellElement.style.paddingBottom) {
              parentCellElement.style.paddingBottom = "0";
            }
            parentCellElement.style.verticalAlign = "top";
            parentCellElement.setAttribute("valign", "top");
          }
        } else {
          // Para outras imagens (ícones sociais), mantém dimensões originais
          const width = img.getAttribute("width") || img.style.width;
          const height = img.getAttribute("height") || img.style.height;

          if (width) {
            img.setAttribute("width", width.replace("px", ""));
            img.style.width = width.includes("px") ? width : `${width}px`;
          }
          if (height) {
            img.setAttribute("height", height.replace("px", ""));
            img.style.height = height.includes("px") ? height : `${height}px`;
          }

          // Ícones sociais devem ser inline ou inline-block (NUNCA block)
          // Verifica se está dentro de um link <a> com display:inline-block
          const parentLink = img.closest("a");
          if (parentLink) {
            const linkStyle = (parentLink as HTMLElement).style;
            if (linkStyle.display === "inline-block") {
              // Link é inline-block, garante que imagem também é inline ou inline-block
              img.style.display = "inline-block";
              img.style.verticalAlign = "middle"; // Alinha verticalmente
            }
          }
        }

        // Remove max-width que pode interferir
        img.style.maxWidth = "none";
      });

      // Preserva margin-top/margin-bottom/line-height em DIVs (para espaçamento)
      const divs = doc.querySelectorAll("div");
      divs.forEach((div) => {
        const divElement = div as HTMLElement;

        // NÃO remove espaços dos text nodes - pode remover espaços importantes
        // como o espaço após "p:", "m:", "w:", "e:", "a:"

        // Detecta se é o subtítulo "IN BANK SERVICE®"
        const text = divElement.textContent?.trim() || "";
        const isBold =
          divElement.style.fontWeight === "bold" ||
          divElement.style.fontWeight === "700" ||
          divElement.querySelector("strong, b") !== null;
        const isShort = text.length < 50;
        const isProbablySubtitle =
          isBold &&
          isShort &&
          (text.includes("®") ||
            text.includes("SERVICE") ||
            text.toUpperCase() === text);

        // Preserva margins explícitos
        if (divElement.style.marginTop) {
          divElement.style.marginTop = divElement.style.marginTop;
        }
        if (divElement.style.marginBottom) {
          divElement.style.marginBottom = divElement.style.marginBottom;
        }
        // Preserva line-height explícito (importante para texto não ficar colado)
        if (divElement.style.lineHeight) {
          divElement.style.lineHeight = divElement.style.lineHeight;
        }

        // ADICIONA <br> após o subtítulo para espaçamento REAL em produção
        if (isProbablySubtitle) {
          // SOLUÇÃO AGRESSIVA: Adiciona MÚLTIPLOS <br> em TODAS as posições possíveis

          // 1. Adiciona <br> DENTRO do elemento (no final do conteúdo)
          const hasBrInside = divElement.querySelector("br");
          if (!hasBrInside) {
            const brInside = doc.createElement("br");
            divElement.appendChild(brInside);
          }

          // 2. Adiciona <br> como SIBLING (imediatamente após o elemento)
          const nextSibling = divElement.nextSibling;
          const isNextBr =
            nextSibling &&
            (nextSibling.nodeName === "BR" ||
              (nextSibling.nodeType === 1 &&
                (nextSibling as Element).tagName === "BR"));

          if (!isNextBr && divElement.parentNode) {
            const brAfter = doc.createElement("br");
            divElement.parentNode.insertBefore(brAfter, divElement.nextSibling);
          }

          // 3. FORÇA display:block no subtítulo (garante quebra de linha)
          divElement.style.display = "block";
        }
      });

      // SOLUÇÃO UNIVERSAL: Converte espaçamento CSS (margin/padding) em <br> REAL
      // Mas PRESERVA as duas primeiras linhas juntas (título + subtítulo colados)
      // Gmail remove CSS, mas preserva <br> tags

      const textContainers = doc.querySelectorAll("div, p, span, td, th");
      textContainers.forEach((container) => {
        const containerEl = container as HTMLElement;

        // Procura elementos filhos diretos que têm texto
        const children = Array.from(containerEl.children) as HTMLElement[];
        let lineCount = 0; // Contador de linhas de texto

        children.forEach((child, index) => {
          const hasText = child.textContent?.trim().length || 0 > 0;

          const hasMarginBottom =
            child.style.marginBottom &&
            child.style.marginBottom !== "0px" &&
            child.style.marginBottom !== "0";
          const hasPaddingBottom =
            child.style.paddingBottom &&
            child.style.paddingBottom !== "0px" &&
            child.style.paddingBottom !== "0";

          // Conta apenas elementos com texto para identificar primeira linha
          let textElementIndex = 0;
          for (let i = 0; i <= index; i++) {
            if ((children[i].textContent?.trim().length || 0) > 0) {
              textElementIndex++;
            }
          }

          // REGRA: NÃO adiciona <br> após a primeira linha de texto (título)
          // Mantém título e subtítulo juntos
          const isFirstTextLine = hasText && textElementIndex === 1;

          // Se tem texto E espaçamento CSS inferior E NÃO é primeira linha de texto
          if (
            hasText &&
            (hasMarginBottom || hasPaddingBottom) &&
            !isFirstTextLine
          ) {
            const nextSibling = child.nextSibling;
            const nextElement = child.nextElementSibling;
            const isNextBr =
              (nextSibling && nextSibling.nodeName === "BR") ||
              (nextElement && nextElement.tagName === "BR");

            if (!isNextBr) {
              // Adiciona <br> depois (converte espaçamento CSS em <br> real)
              const br = doc.createElement("br");
              child.parentNode?.insertBefore(br, child.nextSibling);
            }
          }
        });
      });

      // Preserva formatação de texto (bold, line-height, etc) e garante compatibilidade Gmail
      const allElements = doc.querySelectorAll("*");
      allElements.forEach((element) => {
        const htmlElement = element as HTMLElement;

        // FORÇA bold em tags <strong> e <b> (Gmail pode remover sem estilo inline)
        if (htmlElement.tagName === "STRONG" || htmlElement.tagName === "B") {
          htmlElement.style.fontWeight = "bold";
        }

        // Converte font-weight bold em tag <strong> (Gmail produção preserva tags melhor que CSS)
        if (
          htmlElement.style.fontWeight === "bold" ||
          htmlElement.style.fontWeight === "700"
        ) {
          // Se é DIV ou SPAN com bold, envolve conteúdo em <strong>
          if (htmlElement.tagName === "DIV" || htmlElement.tagName === "SPAN") {
            const hasStrongChild = htmlElement.querySelector("strong, b");
            if (
              !hasStrongChild &&
              htmlElement.textContent &&
              htmlElement.textContent.trim()
            ) {
              const strong = doc.createElement("strong");
              strong.style.fontWeight = "bold";
              strong.innerHTML = htmlElement.innerHTML;
              htmlElement.innerHTML = "";
              htmlElement.appendChild(strong);
            }
          }
        }

        // Preserva font-weight (bold) - usa tag <b> para máxima compatibilidade
        const computedWeight = window.getComputedStyle(element).fontWeight;
        if (
          computedWeight === "bold" ||
          computedWeight === "700" ||
          parseInt(computedWeight) >= 600
        ) {
          htmlElement.style.fontWeight = "bold";

          // Se não for já uma tag <b> ou <strong>, envolve o conteúdo
          if (htmlElement.tagName !== "B" && htmlElement.tagName !== "STRONG") {
            const textContent = htmlElement.textContent;
            if (textContent && textContent.trim()) {
              const b = doc.createElement("b");
              b.style.fontWeight = "bold";
              // Copia estilos inline
              b.style.cssText = htmlElement.style.cssText;
              b.innerHTML = htmlElement.innerHTML;
              htmlElement.innerHTML = "";
              htmlElement.appendChild(b);
            }
          }
        }

        // Preserva line-height com valor específico (CRÍTICO para espaçamento)
        const lineHeight = htmlElement.style.lineHeight;
        if (lineHeight) {
          // FORÇA line-height com !important inline (Gmail tenta remover)
          htmlElement.style.lineHeight = lineHeight;
          // Adiciona ao atributo style raw para máxima força
          const currentStyle = htmlElement.getAttribute("style") || "";
          if (!currentStyle.includes("line-height")) {
            htmlElement.setAttribute(
              "style",
              currentStyle + `;line-height:${lineHeight}`,
            );
          }
        } else if (
          htmlElement.tagName === "P" ||
          htmlElement.tagName === "DIV"
        ) {
          // Define line-height adequado para legibilidade
          // 1.5 para espaçamento confortável entre linhas de texto
          htmlElement.style.lineHeight = "1.5";
        }

        // Garante que font-family está definido
        if (htmlElement.style.fontFamily) {
          htmlElement.style.fontFamily = htmlElement.style.fontFamily;
        }

        // Garante que font-size está definido
        if (htmlElement.style.fontSize) {
          htmlElement.style.fontSize = htmlElement.style.fontSize;
        }

        // Garante que color está definido
        if (htmlElement.style.color) {
          htmlElement.style.color = htmlElement.style.color;
        }

        // Remove estilos problemáticos para Gmail
        htmlElement.style.removeProperty("max-width");
        htmlElement.style.removeProperty("max-height");
      });

      // Preserva bordas (linhas verticais/horizontais) - guarda info para conversão posterior
      const elementsWithBorder = doc.querySelectorAll('[style*="border"]');
      elementsWithBorder.forEach((element) => {
        const style = (element as HTMLElement).style;
        // Preserva informação da borda para processamento
        if (style.borderLeft) {
          (element as HTMLElement).setAttribute(
            "data-original-border-left",
            style.borderLeft,
          );
        }
        if (style.borderRight)
          (element as HTMLElement).style.borderRight = style.borderRight;
        if (style.borderTop)
          (element as HTMLElement).style.borderTop = style.borderTop;
        if (style.borderBottom)
          (element as HTMLElement).style.borderBottom = style.borderBottom;
      });

      // Garante que tabelas mantêm formatação compatível com Gmail
      const tables = doc.querySelectorAll("table");
      tables.forEach((table) => {
        const tableElement = table as HTMLTableElement;

        // Estilos críticos para Gmail
        tableElement.style.borderCollapse = "collapse";
        tableElement.style.borderSpacing = "0"; // FORÇA espaçamento zero entre células
        tableElement.setAttribute("border", "0");
        tableElement.setAttribute("cellpadding", "0");
        tableElement.setAttribute("cellspacing", "0");
        tableElement.setAttribute("role", "presentation");

        // CRÍTICO: Gmail REQUER tbody - sem isso a estrutura quebra!
        // Verifica se já tem tbody
        let tbody = table.querySelector("tbody");
        if (!tbody) {
          // Cria tbody e move todos os TRs para dentro dele
          tbody = doc.createElement("tbody");
          const rows = Array.from(table.querySelectorAll("tr"));
          rows.forEach((row) => {
            tbody!.appendChild(row);
          });
          tableElement.appendChild(tbody);
        }

        // Preserva width se existir
        if (tableElement.style.width && tableElement.style.width !== "auto") {
          tableElement.style.width = tableElement.style.width;
        }

        // PRIMEIRO: Detecta e marca células separadoras (linha vertical com bgcolor)
        const rows = table.querySelectorAll("tr");
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          cells.forEach((cell) => {
            const cellElement = cell as HTMLTableCellElement;
            // Detecta célula separadora: tem bgcolor mas não tem conteúdo/imagens
            const hasBgColor =
              cellElement.style.backgroundColor ||
              cellElement.getAttribute("bgcolor");
            const hasContent =
              cellElement.textContent?.trim() ||
              cellElement.querySelector("img, a, div, span");
            const isVeryNarrow =
              cellElement.style.width && parseInt(cellElement.style.width) < 10;

            if (hasBgColor && !hasContent && isVeryNarrow) {
              // É uma célula separadora - marca para não processar
              cellElement.setAttribute("data-separator-cell", "true");

              // CRÍTICO: Adiciona conteúdo invisível com largura zero
              // Gmail produção preserva células mas pode adicionar padding/border invisível
              const cellWidth =
                cellElement.getAttribute("data-original-width") ||
                cellElement.style.width ||
                "2px";
              const widthValue = parseInt(cellWidth);

              // Usa caractere de largura zero repetido para "preencher" sem afetar visualmente
              // Isto força o Gmail a renderizar a célula mas sem adicionar espaço extra
              cellElement.innerHTML = "\u200B".repeat(10); // Zero-width space

              // Detecta cor original do HTML e salva no state (apenas na primeira vez)
              const bgColor =
                cellElement.style.backgroundColor ||
                cellElement.getAttribute("bgcolor");
              let bgColorHex = "#a9754f"; // fallback

              if (bgColor) {
                if (bgColor.startsWith("#")) {
                  bgColorHex = bgColor;
                } else if (bgColor.startsWith("rgb")) {
                  const match = bgColor.match(/\d+/g);
                  if (match && match.length >= 3) {
                    const r = parseInt(match[0]);
                    const g = parseInt(match[1]);
                    const b = parseInt(match[2]);
                    bgColorHex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
                  }
                }
              }

              // Se tem cor customizada do usuário, usa essa
              if (customSeparatorColor) {
                bgColorHex = customSeparatorColor;
              } else if (!separatorColor) {
                // Salva cor original detectada no state (apenas primeira vez)
                setSeparatorColor(bgColorHex);
              }

              // Define bgcolor em AMBOS formatos
              cellElement.setAttribute("bgcolor", bgColorHex);
              cellElement.style.backgroundColor = bgColorHex;

              // PRESERVA a largura original da célula separadora (barra vertical)
              // Usa cellWidth já calculado acima
              const widthPx = widthValue;

              // FORÇA largura com TODOS os métodos possíveis + !important
              cellElement.style.width = cellWidth;
              cellElement.style.minWidth = cellWidth;
              cellElement.style.maxWidth = cellWidth;
              cellElement.setAttribute("width", widthPx.toString());

              // FORÇA remoção COMPLETA de borders, paddings, margins
              cellElement.style.border = "0";
              cellElement.style.borderWidth = "0";
              cellElement.style.borderLeft = "0";
              cellElement.style.borderRight = "0";
              cellElement.style.borderTop = "0";
              cellElement.style.borderBottom = "0";
              cellElement.style.boxSizing = "content-box"; // NÃO inclui border no width

              cellElement.style.padding = "0";
              cellElement.style.paddingLeft = "0";
              cellElement.style.paddingRight = "0";
              cellElement.style.paddingTop = "0";
              cellElement.style.paddingBottom = "0";
              cellElement.style.margin = "0";
              cellElement.style.marginLeft = "0";
              cellElement.style.marginRight = "0";
              cellElement.style.lineHeight = "1px";
              cellElement.style.fontSize = "1px";

              // Adiciona !important inline diretamente no atributo style
              const currentStyle = cellElement.getAttribute("style") || "";
              cellElement.setAttribute(
                "style",
                currentStyle +
                  `;width:${cellWidth}!important;min-width:${cellWidth}!important;max-width:${cellWidth}!important`,
              );

              // SOLUÇÃO: Criar células spacer invisíveis, usando o padding ORIGINAL das células adjacentes
              // Gmail produção remove padding CSS mas preserva células com conteúdo
              const parentRow = cellElement.parentElement;

              if (parentRow) {
                const prevCell =
                  cellElement.previousElementSibling as HTMLTableCellElement;
                const nextCell =
                  cellElement.nextElementSibling as HTMLTableCellElement;

                // Extrai padding ORIGINAL da célula anterior (logo) - usa o valor SALVO
                let spacerBeforeWidth = "16px"; // fallback
                if (prevCell && prevCell.tagName === "TD") {
                  // USA o valor original salvo no início do processamento
                  const originalPadding = prevCell.getAttribute(
                    "data-original-padding-right",
                  );
                  if (originalPadding && originalPadding !== "0px") {
                    spacerBeforeWidth = originalPadding;
                  } else {
                  }
                  // Remove o padding da célula original (vai ser substituído pelo spacer)
                  prevCell.style.paddingRight = "0";
                }

                // Extrai padding ORIGINAL da célula seguinte (texto) - usa o valor SALVO
                let spacerAfterWidth = "16px"; // fallback
                if (nextCell && nextCell.tagName === "TD") {
                  // USA o valor original salvo no início do processamento
                  const originalPadding = nextCell.getAttribute(
                    "data-original-padding-left",
                  );
                  if (originalPadding && originalPadding !== "0px") {
                    spacerAfterWidth = originalPadding;
                  } else {
                  }
                  // Remove o padding da célula original (vai ser substituído pelo spacer)
                  nextCell.style.paddingLeft = "0";
                }

                // Cria célula spacer ANTES da barra (entre logo e barra)
                const spacerBefore = doc.createElement("td");
                spacerBefore.style.width = spacerBeforeWidth; // USA o padding original!
                spacerBefore.style.minWidth = spacerBeforeWidth; // FORÇA min-width para Gmail não comprimir
                spacerBefore.setAttribute(
                  "width",
                  spacerBeforeWidth.replace("px", ""),
                ); // Atributo HTML width
                spacerBefore.style.padding = "0";
                spacerBefore.style.margin = "0";
                // Adiciona múltiplos &nbsp; proporcionais ao tamanho (1 &nbsp; ≈ 7px)
                const beforePx = parseInt(spacerBeforeWidth);
                const beforeSpaces = Math.max(1, Math.round(beforePx / 7));
                spacerBefore.innerHTML = "&nbsp;".repeat(beforeSpaces);
                spacerBefore.setAttribute("data-spacer-cell", "true");
                parentRow.insertBefore(spacerBefore, cellElement);

                // Cria célula spacer DEPOIS da barra (entre barra e texto)
                const spacerAfter = doc.createElement("td");
                spacerAfter.style.width = spacerAfterWidth; // USA o padding original!
                spacerAfter.style.minWidth = spacerAfterWidth; // FORÇA min-width para Gmail não comprimir
                spacerAfter.setAttribute(
                  "width",
                  spacerAfterWidth.replace("px", ""),
                ); // Atributo HTML width
                spacerAfter.style.padding = "0";
                spacerAfter.style.margin = "0";
                // Adiciona múltiplos &nbsp; proporcionais ao tamanho (1 &nbsp; ≈ 7px)
                const afterPx = parseInt(spacerAfterWidth);
                const afterSpaces = Math.max(1, Math.round(afterPx / 7));
                spacerAfter.innerHTML = "&nbsp;".repeat(afterSpaces);
                spacerAfter.setAttribute("data-spacer-cell", "true");

                // Insere DEPOIS da célula separadora (barra vertical)
                const nextElement = cellElement.nextElementSibling;
                if (nextElement) {
                  parentRow.insertBefore(spacerAfter, nextElement);
                } else {
                  parentRow.appendChild(spacerAfter);
                }
              }
            }
          });
        });

        // DEPOIS: Processa border-left nas células (mas não nas separadoras)
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td"));

          cells.forEach((cell) => {
            const cellElement = cell as HTMLTableCellElement;

            // NÃO processa células separadoras
            if (cellElement.getAttribute("data-separator-cell") === "true") {
              return;
            }

            const borderLeft =
              cellElement.style.borderLeft ||
              cellElement.getAttribute("data-original-border-left");

            if (borderLeft && borderLeft !== "none") {
              // Extrai cor da borda
              let borderColor = "#cccccc";
              const colorMatch = borderLeft.match(
                /#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/,
              );
              if (colorMatch) {
                borderColor = colorMatch[0];
                // Converte rgb() para hex
                if (borderColor.startsWith("rgb")) {
                  const rgbMatch = borderColor.match(/\d+/g);
                  if (rgbMatch && rgbMatch.length >= 3) {
                    const r = parseInt(rgbMatch[0]);
                    const g = parseInt(rgbMatch[1]);
                    const b = parseInt(rgbMatch[2]);
                    borderColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
                  }
                }
              }

              // Extrai largura ORIGINAL da borda (não força valor)
              let borderWidth = 1; // fallback padrão
              const widthMatch = borderLeft.match(/(\d+(?:\.\d+)?)px/);
              if (widthMatch) {
                borderWidth = parseFloat(widthMatch[1]);
              }

              // Detecta padding-left ORIGINAL da célula com borda
              // Este é o espaçamento DEPOIS da linha (entre linha e texto)
              let spacingAfter = 20; // fallback padrão (mysignature usa 20px)
              const paddingLeftValue =
                cellElement.style.paddingLeft ||
                cellElement.getAttribute("data-original-padding-left");
              if (paddingLeftValue) {
                const paddingMatch =
                  paddingLeftValue.match(/(\d+(?:\.\d+)?)px/);
                if (paddingMatch) {
                  spacingAfter = parseFloat(paddingMatch[1]);
                }
              }

              // Detecta padding-right da célula anterior (logo)
              // Este é o espaçamento ANTES da linha (entre logo e linha)
              let spacingBefore = 20; // fallback padrão (mysignature usa 20px)
              let prevPaddingRight = "";
              const prevCell = cellElement.previousElementSibling;
              if (prevCell && prevCell.tagName === "TD") {
                prevPaddingRight = (prevCell as HTMLElement).style.paddingRight;

                // Verifica também padding geral da célula anterior
                const prevPadding = (prevCell as HTMLElement).style.padding;

                if (prevPaddingRight) {
                  const prevPaddingMatch =
                    prevPaddingRight.match(/(\d+(?:\.\d+)?)px/);
                  if (prevPaddingMatch) {
                    spacingBefore = parseFloat(prevPaddingMatch[1]);
                  }
                } else if (prevPadding) {
                  // Se não tem padding-right mas tem padding geral, extrai o valor
                  const prevPaddingMatch =
                    prevPadding.match(/(\d+(?:\.\d+)?)px/);
                  if (prevPaddingMatch) {
                    spacingBefore = parseFloat(prevPaddingMatch[1]);
                  }
                }
              }

              // Preserva valores originais para uso posterior
              cellElement.setAttribute(
                "data-original-padding-left",
                `${spacingAfter}px`,
              );
              cellElement.setAttribute(
                "data-spacing-after",
                `${spacingAfter}px`,
              );
              cellElement.setAttribute(
                "data-spacing-before",
                `${spacingBefore}px`,
              );

              // Preserva a borda CSS com largura original
              cellElement.style.borderLeft = `${borderWidth}px solid ${borderColor}`;
              cellElement.style.borderLeftWidth = `${borderWidth}px`;
              cellElement.style.borderLeftStyle = "solid";
              cellElement.style.borderLeftColor = borderColor;
              cellElement.style.paddingLeft = `${spacingAfter}px`; // Espaçamento após a linha (ORIGINAL, não dividido)

              // Garante padding-right na célula anterior (logo) para espaçamento antes da linha
              if (prevCell && prevCell.tagName === "TD") {
                // Se ainda não tem padding, adiciona; se já tem, mantém
                if (
                  !prevPaddingRight ||
                  prevPaddingRight === "0px" ||
                  prevPaddingRight === "0"
                ) {
                  (prevCell as HTMLElement).style.paddingRight =
                    `${spacingBefore}px`;
                }
              }
            }
          });
        });

        // Processa todas as células para garantir estilos consistentes
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          cells.forEach((cell) => {
            const cellElement = cell as HTMLTableCellElement;

            // Preserva padding original se existir (para células sem borda)
            // NÃO define padding se célula separadora ou se já tem paddings individuais
            const isSeparator =
              cellElement.getAttribute("data-separator-cell") === "true";
            const hasIndividualPadding =
              cellElement.style.paddingRight ||
              cellElement.style.paddingLeft ||
              cellElement.style.paddingTop ||
              cellElement.style.paddingBottom;
            const originalPadding =
              cellElement.style.padding || cellElement.getAttribute("padding");

            if (!isSeparator && !originalPadding && !hasIndividualPadding) {
              // Define apenas padding horizontal como 0, preserva vertical
              cellElement.style.paddingLeft = "0";
              cellElement.style.paddingRight = "0";
              // Não força padding-top/bottom a 0 - deixa o browser usar o padrão ou valor herdado
            }

            // Garante que vertical-align está definido
            const verticalAlign = cellElement.style.verticalAlign || "top";
            cellElement.style.verticalAlign = verticalAlign;
            cellElement.setAttribute("valign", verticalAlign);

            cellElement.style.margin = "0";
            cellElement.style.removeProperty("display");
          });
        });
      });

      // Preserva parágrafos e line breaks
      const paragraphs = doc.querySelectorAll("p");
      paragraphs.forEach((p) => {
        const pElement = p as HTMLElement;

        // Remove espaços/tabs/whitespace no INÍCIO de text nodes
        pElement.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            node.textContent = node.textContent.replace(/^\s+/, "");
          }
        });

        // Detecta se é o subtítulo "IN BANK SERVICE®"
        const text = pElement.textContent?.trim() || "";
        const isBold =
          pElement.style.fontWeight === "bold" ||
          pElement.style.fontWeight === "700" ||
          pElement.querySelector("strong, b") !== null;
        const isShort = text.length < 50;
        const isProbablySubtitle =
          isBold &&
          isShort &&
          (text.includes("®") ||
            text.includes("SERVICE") ||
            text.toUpperCase() === text);

        // PRESERVA margin/padding original se existir (importante para espaçamento)
        // Só define como '0' se NÃO tiver margin/padding definido
        if (
          !pElement.style.margin &&
          !pElement.style.marginTop &&
          !pElement.style.marginBottom &&
          !pElement.style.marginLeft &&
          !pElement.style.marginRight
        ) {
          pElement.style.margin = "0";
        }

        if (
          !pElement.style.padding &&
          !pElement.style.paddingTop &&
          !pElement.style.paddingBottom &&
          !pElement.style.paddingLeft &&
          !pElement.style.paddingRight
        ) {
          pElement.style.padding = "0";
        }

        // ADICIONA <br> após o subtítulo para espaçamento REAL em produção
        if (isProbablySubtitle) {
          // SOLUÇÃO AGRESSIVA: Adiciona MÚLTIPLOS <br> em TODAS as posições possíveis

          // 1. Adiciona <br> DENTRO do elemento (no final do conteúdo)
          const hasBrInside = pElement.querySelector("br");
          if (!hasBrInside) {
            const brInside = doc.createElement("br");
            pElement.appendChild(brInside);
          }

          // 2. Adiciona <br> como SIBLING (imediatamente após o elemento)
          const nextSibling = pElement.nextSibling;
          const isNextBr =
            nextSibling &&
            (nextSibling.nodeName === "BR" ||
              (nextSibling.nodeType === 1 &&
                (nextSibling as Element).tagName === "BR"));

          if (!isNextBr && pElement.parentNode) {
            const brAfter = doc.createElement("br");
            pElement.parentNode.insertBefore(brAfter, pElement.nextSibling);
          }

          // 3. FORÇA display:block no subtítulo (garante quebra de linha)
          pElement.style.display = "block";
        }
      });

      const processed = doc.body.innerHTML;

      // Valida se o processamento gerou conteúdo
      if (!processed || processed.trim() === "") {
        setError(
          "Não foi possível processar o conteúdo. Tente colar novamente.",
        );
        return "";
      }

      // Extrai todos os links editáveis (exceto ícones sociais que têm imagem)
      const extractedLinks: Array<{
        text: string;
        url: string;
        index: number;
      }> = [];
      const textLinks = doc.querySelectorAll("a");
      let linkIndex = 0;
      textLinks.forEach((link) => {
        const hasImage = link.querySelector("img");
        if (!hasImage) {
          // É um link de texto, não um ícone
          const text = link.textContent || "";
          const url = link.getAttribute("href") || "";
          if (text && url) {
            extractedLinks.push({ text, url, index: linkIndex });
            // Adiciona um data-attribute para identificar este link
            link.setAttribute("data-link-index", linkIndex.toString());
            linkIndex++;
          }
        }
      });
      setLinks(extractedLinks);

      setProcessedHtml(processed);
      return processed;
    } catch (err) {
      console.error("Erro ao processar HTML:", err);
      setError(
        "Erro ao processar HTML. Certifique-se de colar HTML válido ou uma tabela do Word/LibreOffice.",
      );
      return "";
    }
  };

  const handlePasteArea = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Previne comportamento padrão apenas se for paste event
    if (e.type === "paste") {
      e.preventDefault();

      const clipboardData = e.clipboardData || (window as any).clipboardData;
      const htmlData = clipboardData.getData("text/html");
      const textData = clipboardData.getData("text/plain");

      // RESET de cores quando carrega nova assinatura
      setTextColor("");
      setSeparatorColor("");

      if (htmlData) {
        // Remove cores inline do HTML original antes de colocar no pasteArea
        const cleanedHtml = removeInlineColors(htmlData);

        // Limpa a área de paste com HTML sem cores inline
        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = cleanedHtml;
        }
        processHtml(cleanedHtml, undefined, undefined);
      } else if (textData) {
        if (pasteAreaRef.current) {
          pasteAreaRef.current.textContent = textData;
        }
        processHtml(textData, undefined, undefined);
      }
    }
  };

  const handleContentChange = () => {
    if (pasteAreaRef.current) {
      const currentContent = pasteAreaRef.current.innerHTML;
      if (
        currentContent &&
        currentContent !==
          '<span class="text-gray-400 select-none">Edite a sua assinatura, depois de a carregar</span>'
      ) {
        processHtml(currentContent, undefined, separatorColor);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (
      file &&
      (file.type === "text/html" ||
        file.name.endsWith(".html") ||
        file.name.endsWith(".htm"))
    ) {
      // RESET de cores quando carrega nova assinatura
      setTextColor("");
      setSeparatorColor("");

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;

        // Remove cores inline do HTML antes de colocar no pasteArea
        const cleanedHtml = removeInlineColors(content);

        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = cleanedHtml;
        }
        processHtml(cleanedHtml, undefined, undefined);
      };
      reader.readAsText(file);
    } else {
      setError("Por favor, selecione um arquivo HTML válido (.html ou .htm).");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleImageUpload = (
    imageId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;

        const parser = new DOMParser();
        const doc = parser.parseFromString(processedHtml, "text/html");
        const img = doc.querySelector(`img[data-image-id="${imageId}"]`);

        if (img) {
          img.setAttribute("src", base64);
          const newHtml = doc.body.innerHTML;
          setProcessedHtml(newHtml);

          // Atualiza também a área de paste
          if (pasteAreaRef.current) {
            const pasteDoc = parser.parseFromString(
              pasteAreaRef.current.innerHTML,
              "text/html",
            );
            const pasteImg = pasteDoc.querySelector(
              'img[data-image-id="' + imageId + '"]',
            );
            if (pasteImg) {
              pasteImg.setAttribute("src", base64);
              pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML;
            }
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      setError("Por favor, selecione uma imagem válida.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleSocialLinkUpdate = (imageId: string, newLink: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, "text/html");
    const img = doc.querySelector(`img[data-image-id="${imageId}"]`);

    if (img) {
      // Atualiza o atributo data-social-link
      img.setAttribute("data-social-link", newLink);

      // Envolve a imagem em um link se houver URL válida
      if (newLink && newLink.trim() !== "") {
        const link = doc.createElement("a");
        link.href = newLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        // Copia estilos da imagem para o link se necessário
        const imgParent = img.parentNode;
        imgParent?.replaceChild(link, img);
        link.appendChild(img);
      }

      const newHtml = doc.body.innerHTML;
      setProcessedHtml(newHtml);

      // Atualiza também a área de paste
      if (pasteAreaRef.current) {
        const pasteDoc = parser.parseFromString(
          pasteAreaRef.current.innerHTML,
          "text/html",
        );
        const pasteImg = pasteDoc.querySelector(
          'img[data-image-id="' + imageId + '"]',
        );
        if (pasteImg) {
          pasteImg.setAttribute("data-social-link", newLink);

          if (newLink && newLink.trim() !== "") {
            const pasteLink = pasteDoc.createElement("a");
            pasteLink.href = newLink;
            pasteLink.target = "_blank";
            pasteLink.rel = "noopener noreferrer";

            const pasteImgParent = pasteImg.parentNode;
            pasteImgParent?.replaceChild(pasteLink, pasteImg);
            pasteLink.appendChild(pasteImg);
          }

          pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML;
        }
      }
    }
  };

  const updateLogoSize = (width: number, height: number) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, "text/html");
    const logo = doc.querySelector('img[data-image-id="img-0"]');

    if (logo) {
      logo.setAttribute("width", String(width));
      if (height > 0) {
        logo.setAttribute("height", String(height));
        (logo as HTMLElement).style.height = `${height}px`;
      } else {
        // Se height é 0, usa auto
        logo.removeAttribute("height");
        (logo as HTMLElement).style.height = "auto";
      }
      (logo as HTMLElement).style.width = `${width}px`;
      (logo as HTMLElement).style.objectFit = "contain";

      // Atualiza a célula da tabela que contém o logo
      let parentCell = logo.parentElement;
      while (parentCell && parentCell.tagName !== "TD") {
        parentCell = parentCell.parentElement;
      }

      if (parentCell) {
        // Busca espaçamento detectado da célula com borda (próxima célula)
        let spacingBefore = 15; // fallback
        const nextCell = (parentCell as HTMLElement).nextElementSibling;
        if (nextCell) {
          const spacingBeforeAttr = nextCell.getAttribute(
            "data-spacing-before",
          );
          if (spacingBeforeAttr) {
            const match = spacingBeforeAttr.match(/(\d+(?:\.\d+)?)px/);
            if (match) spacingBefore = parseFloat(match[1]);
          }
        }

        // Define célula do logo SEM width fixo (deixa crescer com logo + padding)
        (parentCell as HTMLElement).style.removeProperty("width");
        (parentCell as HTMLElement).style.removeProperty("min-width");
        (parentCell as HTMLElement).style.removeProperty("max-width");
        (parentCell as HTMLElement).removeAttribute("width");
        (parentCell as HTMLElement).style.paddingRight = `${spacingBefore}px`; // Usa valor detectado
        (parentCell as HTMLElement).style.paddingLeft = "0";
        (parentCell as HTMLElement).style.paddingTop = "0";
        (parentCell as HTMLElement).style.paddingBottom = "0";
        (parentCell as HTMLElement).style.verticalAlign = "top";
        (parentCell as HTMLElement).setAttribute("valign", "top");
      }

      const newHtml = doc.body.innerHTML;
      setProcessedHtml(newHtml);

      // Atualiza também a área de paste
      if (pasteAreaRef.current) {
        const pasteDoc = parser.parseFromString(
          pasteAreaRef.current.innerHTML,
          "text/html",
        );
        const pasteLogo = pasteDoc.querySelector('img[data-image-id="img-0"]');
        if (pasteLogo) {
          pasteLogo.setAttribute("width", String(width));
          pasteLogo.setAttribute("height", String(height));
          (pasteLogo as HTMLElement).style.width = `${width}px`;
          (pasteLogo as HTMLElement).style.height = `${height}px`;
          (pasteLogo as HTMLElement).style.objectFit = "contain";

          // Atualiza a célula da tabela no paste area
          let pasteParentCell = pasteLogo.parentElement;
          while (pasteParentCell && pasteParentCell.tagName !== "TD") {
            pasteParentCell = pasteParentCell.parentElement;
          }

          if (pasteParentCell) {
            // Busca espaçamento detectado da célula com borda (próxima célula)
            let spacingBefore = 15; // fallback
            const nextCell = (pasteParentCell as HTMLElement)
              .nextElementSibling;
            if (nextCell) {
              const spacingBeforeAttr = nextCell.getAttribute(
                "data-spacing-before",
              );
              if (spacingBeforeAttr) {
                const match = spacingBeforeAttr.match(/(\d+(?:\.\d+)?)px/);
                if (match) spacingBefore = parseFloat(match[1]);
              }
            }

            // Define célula do logo SEM width fixo (deixa crescer com logo + padding)
            (pasteParentCell as HTMLElement).style.removeProperty("width");
            (pasteParentCell as HTMLElement).style.removeProperty("min-width");
            (pasteParentCell as HTMLElement).style.removeProperty("max-width");
            (pasteParentCell as HTMLElement).removeAttribute("width");
            (pasteParentCell as HTMLElement).style.paddingRight =
              `${spacingBefore}px`; // Usa valor detectado
            (pasteParentCell as HTMLElement).style.paddingLeft = "0";
            (pasteParentCell as HTMLElement).style.paddingTop = "0";
            (pasteParentCell as HTMLElement).style.paddingBottom = "0";
            (pasteParentCell as HTMLElement).style.verticalAlign = "top";
            (pasteParentCell as HTMLElement).setAttribute("valign", "top");
          }

          pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML;
        }
      }
    }
  };

  const handleLogoWidthChange = (newWidth: number) => {
    setLogoWidth(newWidth);

    if (aspectRatioLocked && originalAspectRatio && originalAspectRatio > 0) {
      const newHeight = Math.round(newWidth / originalAspectRatio);
      setLogoHeight(newHeight);
      updateLogoSize(newWidth, newHeight);
    } else {
      updateLogoSize(newWidth, logoHeight);
    }
  };

  const handleLogoHeightChange = (newHeight: number) => {
    setLogoHeight(newHeight);

    if (aspectRatioLocked && originalAspectRatio && originalAspectRatio > 0) {
      const newWidth = Math.round(newHeight * originalAspectRatio);
      setLogoWidth(newWidth);
      updateLogoSize(newWidth, newHeight);
    } else {
      updateLogoSize(logoWidth, newHeight);
    }
  };

  const optimizeForGmail = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // CRÍTICO: Converte border-left em célula separada com background
    // Gmail remove bordas CSS no composer, mas preserva background-color
    const tables = doc.querySelectorAll("table");
    tables.forEach((table) => {
      const tableElement = table as HTMLTableElement;

      // Força atributos essenciais para Gmail
      tableElement.setAttribute("border", "0");
      tableElement.setAttribute("cellpadding", "0");
      tableElement.setAttribute("cellspacing", "0");
      tableElement.setAttribute("role", "presentation");

      // CRÍTICO: Gmail REQUER tbody
      let tbody = table.querySelector("tbody");
      if (!tbody) {
        tbody = doc.createElement("tbody");
        const rows = Array.from(table.querySelectorAll(":scope > tr"));
        rows.forEach((row) => {
          tbody!.appendChild(row);
        });
        tableElement.appendChild(tbody);
      }

      // MANTÉM estrutura original de tabela - NÃO converte nada!
      // Se o HTML original tem célula com bgcolor, mantém
      // Se tem border-left, mantém também
      // Gmail produção parece aceitar melhor o HTML não-modificado

      // Estilos críticos inline
      tableElement.style.borderCollapse = "collapse";
      tableElement.style.borderSpacing = "0";

      // Remove propriedades CSS que o Gmail não suporta
      tableElement.style.removeProperty("table-layout");
      tableElement.style.removeProperty("box-sizing");

      // Remove width se for auto ou 100%
      if (
        tableElement.style.width === "auto" ||
        tableElement.style.width === "100%"
      ) {
        tableElement.style.removeProperty("width");
        tableElement.removeAttribute("width");
      }
    });

    // Mantém padding original da célula do logo (não remove!)

    // Otimiza células
    const cells = doc.querySelectorAll("td");
    cells.forEach((cell) => {
      const cellElement = cell as HTMLTableCellElement;

      // Força vertical-align em ambos formatos (crítico!)
      const valign =
        cellElement.style.verticalAlign ||
        cellElement.getAttribute("valign") ||
        "top";
      cellElement.style.verticalAlign = valign;
      cellElement.setAttribute("valign", valign);

      // Garante que width está em atributo E style (ambos necessários)
      const width =
        cellElement.style.width || cellElement.getAttribute("width");
      if (width) {
        const widthValue = parseInt(width.toString().replace("px", ""));
        if (!isNaN(widthValue) && widthValue > 0) {
          cellElement.setAttribute("width", widthValue.toString());
          cellElement.style.width = `${widthValue}px`;
        }
      }

      // MANTÉM border-left para Gmail (funciona tanto no editor quanto em produção)

      // Remove propriedades CSS não suportadas pelo Gmail
      cellElement.style.removeProperty("box-sizing");
      cellElement.style.removeProperty("min-width");
      cellElement.style.removeProperty("max-width");
      cellElement.style.removeProperty("min-height");
      cellElement.style.removeProperty("max-height");
      cellElement.style.removeProperty("display"); // Gmail gerencia isso
    });

    // Remove display das linhas (Gmail gerencia automaticamente)
    const rows = doc.querySelectorAll("tr");
    rows.forEach((row) => {
      (row as HTMLTableRowElement).style.removeProperty("display");
    });

    // Otimiza imagens
    const images = doc.querySelectorAll("img");
    images.forEach((img) => {
      const imgElement = img as HTMLImageElement;

      // Display block APENAS para logo (não para ícones sociais que devem ficar inline)
      // Detecta se é logo pelo data-image-id ou se está numa célula sozinha
      const isLogo = imgElement.getAttribute("data-image-id") === "img-0";
      if (isLogo) {
        imgElement.style.display = "block";
      } else {
        // Ícones sociais: garante inline-block se estiver dentro de link com inline-block
        const parentLink = imgElement.closest("a");
        if (
          parentLink &&
          (parentLink as HTMLElement).style.display === "inline-block"
        ) {
          imgElement.style.display = "inline-block";
          imgElement.style.verticalAlign = "middle";
        }
      }
      imgElement.style.border = "none";
      imgElement.style.outline = "none";
      imgElement.style.textDecoration = "none";

      // Remove line-height que pode afetar espaçamento
      imgElement.style.removeProperty("line-height");

      // Garante width e height em AMBOS formatos (atributo + CSS)
      const width = imgElement.style.width || imgElement.getAttribute("width");
      const height =
        imgElement.style.height || imgElement.getAttribute("height");

      if (width) {
        const widthValue = parseInt(width.toString().replace("px", ""));
        if (!isNaN(widthValue)) {
          imgElement.setAttribute("width", widthValue.toString());
          imgElement.style.width = `${widthValue}px`;
        }
      }

      if (height) {
        const heightValue = parseInt(height.toString().replace("px", ""));
        if (!isNaN(heightValue)) {
          imgElement.setAttribute("height", heightValue.toString());
          imgElement.style.height = `${heightValue}px`;
        }
      }

      // Remove propriedades problemáticas
      imgElement.style.removeProperty("max-width");
      imgElement.style.removeProperty("max-height");
      imgElement.style.removeProperty("object-fit");
    });

    // Otimiza links
    const links = doc.querySelectorAll("a");
    links.forEach((link) => {
      const linkElement = link as HTMLAnchorElement;

      // FORÇA display: inline-block em TODOS os links (ícones sociais precisam ficar horizontais)
      linkElement.style.display = "inline-block";

      // FORÇA margin-right para espaçamento entre ícones
      const hasImage = linkElement.querySelector("img");
      if (hasImage) {
        // É um link com imagem (ícone social) - garante espaçamento
        linkElement.style.marginRight = "5px";
      }

      // Garante target e rel para segurança
      if (!linkElement.getAttribute("target")) {
        linkElement.setAttribute("target", "_blank");
      }
      if (!linkElement.getAttribute("rel")) {
        linkElement.setAttribute("rel", "noopener noreferrer");
      }
    });

    // Otimiza elementos de texto para Gmail
    const textElements = doc.querySelectorAll(
      "p, div, span, td, b, strong, i, em",
    );
    textElements.forEach((element) => {
      const htmlElement = element as HTMLElement;

      // Aplica cor customizada do texto se fornecida
      if (customTextColor) {
        // Aplica cor a todos os elementos de texto, exceto links (que devem manter cor de link)
        const isLink = htmlElement.tagName === "A";
        if (
          !isLink &&
          htmlElement.textContent &&
          htmlElement.textContent.trim() !== ""
        ) {
          htmlElement.style.color = customTextColor;
        }
      }

      // Preserva e reforça bold
      if (
        htmlElement.style.fontWeight === "bold" ||
        htmlElement.style.fontWeight === "700" ||
        htmlElement.tagName === "B" ||
        htmlElement.tagName === "STRONG"
      ) {
        htmlElement.style.fontWeight = "bold";

        // Se não é uma tag <b>, converte para <b>
        if (
          htmlElement.tagName !== "B" &&
          htmlElement.tagName !== "STRONG" &&
          htmlElement.textContent
        ) {
          const text = htmlElement.textContent.trim();
          if (text) {
            const b = doc.createElement("b");
            b.style.fontWeight = "bold";
            b.textContent = text;
            htmlElement.textContent = "";
            htmlElement.appendChild(b);
          }
        }
      }

      // Preserva font-size original ou define padrão
      if (htmlElement.style.fontSize) {
        // Mantém o font-size original
        htmlElement.style.fontSize = htmlElement.style.fontSize;
      }

      // Preserva line-height original (CRÍTICO para espaçamento de texto)
      // Força em MÚLTIPLOS formatos para Gmail produção
      if (htmlElement.style.lineHeight) {
        const lineHeightValue = htmlElement.style.lineHeight;
        htmlElement.style.lineHeight = lineHeightValue;
        htmlElement.setAttribute(
          "style",
          htmlElement.getAttribute("style") +
            `;line-height:${lineHeightValue} !important`,
        );
      }

      // Para DIVs e P: força display:block + height mínimo se tem margin
      if (htmlElement.tagName === "P" || htmlElement.tagName === "DIV") {
        const hasMarginBottom =
          htmlElement.style.marginBottom &&
          htmlElement.style.marginBottom !== "0px";
        const hasMarginTop =
          htmlElement.style.marginTop && htmlElement.style.marginTop !== "0px";

        if (hasMarginBottom || hasMarginTop) {
          // Força display block e height para Gmail respeitar
          htmlElement.style.display = "block";
          // Adiciona height mínimo baseado no margin
          if (hasMarginBottom) {
            const marginValue = parseInt(htmlElement.style.marginBottom);
            if (!isNaN(marginValue) && marginValue > 0) {
              // Garante que elemento ocupa espaço
              htmlElement.style.minHeight = "1em";
            }
          }
        } else {
          // Não tem margin - define como 0
          htmlElement.style.margin = "0";
          htmlElement.style.padding = "0";
        }
      }
    });

    // Otimiza <br> - Gmail renderiza com espaçamento normal
    const breaks = doc.querySelectorAll("br");
    breaks.forEach((br) => {
      const parent = br.parentElement;
      if (parent && !parent.style.lineHeight) {
        parent.style.lineHeight = "normal";
      }
    });

    // Limpa todos os elementos
    const allElements = doc.querySelectorAll("*");
    allElements.forEach((element) => {
      const htmlElement = element as HTMLElement;

      // Remove atributos data-* (desnecessários no email final)
      Array.from(htmlElement.attributes).forEach((attr) => {
        if (attr.name.startsWith("data-")) {
          htmlElement.removeAttribute(attr.name);
        }
      });

      // Remove classes (Gmail pode sobrescrever)
      if (htmlElement.hasAttribute("class")) {
        htmlElement.removeAttribute("class");
      }
    });

    return doc.body.innerHTML.trim();
  };

  const applyColorToSelection = () => {
    if (!pasteAreaRef.current || !textColor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setError("Por favor, selecione o texto que deseja colorir.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const range = selection.getRangeAt(0);

    // Verifica se a seleção está dentro da área editável
    if (!pasteAreaRef.current.contains(range.commonAncestorContainer)) {
      setError("Por favor, selecione texto dentro da área de edição.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Cria um span com a cor
    const span = document.createElement("span");
    span.style.color = textColor;

    try {
      // Envolve o conteúdo selecionado no span
      range.surroundContents(span);

      // Limpa seleção
      selection.removeAllRanges();

      // Reprocessa o HTML para atualizar a pré-visualização
      if (pasteAreaRef.current) {
        const currentContent = pasteAreaRef.current.innerHTML;
        const processed = processHtml(
          currentContent,
          textColor,
          separatorColor,
        );
        if (processed) {
          setProcessedHtml(processed);
        }
      }
    } catch (error) {
      // Se falhar (seleção complexa), tenta abordagem alternativa
      try {
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);

        selection.removeAllRanges();

        // Reprocessa o HTML para atualizar a pré-visualização
        if (pasteAreaRef.current) {
          const currentContent = pasteAreaRef.current.innerHTML;
          const processed = processHtml(
            currentContent,
            textColor,
            separatorColor,
          );
          if (processed) {
            setProcessedHtml(processed);
          }
        }
      } catch (e) {
        setError(
          "Não foi possível aplicar cor a esta seleção. Tente selecionar apenas texto simples.",
        );
        setTimeout(() => setError(""), 3000);
      }
    }
  };

  const updateLink = (index: number, newUrl: string) => {
    if (!previewRef.current) return;

    // Encontra o link no preview pelo data-link-index
    const linkElement = previewRef.current.querySelector(
      `a[data-link-index="${index}"]`,
    ) as HTMLAnchorElement;
    if (linkElement) {
      linkElement.setAttribute("href", newUrl);

      // Atualiza o state dos links
      setLinks((prevLinks) =>
        prevLinks.map((link) =>
          link.index === index ? { ...link, url: newUrl } : link,
        ),
      );

      // Atualiza o HTML processado
      setProcessedHtml(previewRef.current.innerHTML);
    }
  };

  const copyToClipboard = async () => {
    try {
      if (previewRef.current && processedHtml) {
        // USA O HTML PROCESSADO DIRETO - sem otimizações que Gmail produção rejeita!
        const htmlToCopy = processedHtml;

        // Usa método antigo confiável (API moderna tem problemas de compatibilidade)
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlToCopy;
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-9999px";
        document.body.appendChild(tempDiv);

        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        const successful = document.execCommand("copy");

        selection?.removeAllRanges();
        document.body.removeChild(tempDiv);

        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error("Falha ao copiar");
        }
      }
    } catch (err) {
      setError(
        "Erro ao copiar. Tente selecionar manualmente o conteúdo da pré-visualização.",
      );
      setTimeout(() => setError(""), 5000);
    }
  };

  const getImageButtons = () => {
    if (!processedHtml) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, "text/html");
    const images = doc.querySelectorAll("img[data-image-id]");

    return Array.from(images).map((img, index) => {
      const imageId = img.getAttribute("data-image-id") || "";
      const altText = img.getAttribute("alt") || `Imagem ${index + 1}`;
      const isLogo = altText.toLowerCase().includes("logo") || index === 0;
      const socialLink = img.getAttribute("data-social-link") || "";
      const hasSocialLink = socialLink !== "";

      return (
        <div key={imageId} className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0">
              <img
                src={img.getAttribute("src") || ""}
                alt={altText}
                className="w-16 h-16 object-contain rounded border border-gray-300 bg-white"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate flex items-center gap-1">
                {isLogo ? (
                  <Building2 className="w-4 h-4" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {altText}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isLogo ? "Logo da empresa" : "Ícone/Imagem"}
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
                onChange={(e) =>
                  handleSocialLinkUpdate(imageId, e.target.value)
                }
                placeholder="https://..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      );
    });
  };

  const imageButtons = getImageButtons();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              Email Signature Studio
            </h1>
            <p className="text-gray-600">
              Crie, edite e gerencie suas assinaturas de email para Gmail
            </p>
          </div>

          {/* Como definir a assinatura no Gmail */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-start gap-2">
              <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Como definir a assinatura no Gmail:</strong> Após
                copiar, vá ao Gmail → Configurações → Ver todas as configurações
                → Geral → Assinatura → Cole a assinatura copiada (Ctrl+V) →
                Salvar alterações
              </span>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Tabs de navegação */}
          <Tabs defaultValue="editor" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger
                value="editor"
                className="flex items-center gap-2 text-base"
              >
                <Edit3 className="w-4 h-4" />
                Editor de Assinatura
              </TabsTrigger>
              <TabsTrigger
                value="saved"
                className="flex items-center gap-2 text-base"
              >
                <FolderOpen className="w-4 h-4" />
                Assinaturas Guardadas ({savedSignatures.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Assinaturas Guardadas */}
            <TabsContent value="saved" className="mt-0">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FolderOpen className="w-6 h-6" />
                    Assinaturas Guardadas ({savedSignatures.length})
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={exportAllSignatures}
                      disabled={savedSignatures.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      title="Exportar backup HTML de todas as assinaturas"
                    >
                      <Download className="w-4 h-4" />
                      Exportar Assinatura
                    </button>
                  </div>
                </div>

                {/* Aviso sobre localStorage */}
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Aviso:</strong> As assinaturas são guardadas
                      localmente no seu navegador. Se limpar os dados ou cache
                      do browser, perderá as assinaturas guardadas. Use a função
                      "Exportar" para fazer backup.
                    </span>
                  </p>
                </div>

                {/* Dialog de Confirmação de Eliminação */}
                {deleteConfirmId && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Eliminar Assinatura
                          </h3>
                          <p className="text-gray-600 text-sm">
                            Tem certeza que deseja eliminar esta assinatura?
                            Esta ação não pode ser desfeita.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={deleteSignature}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de Assinaturas */}
                {savedSignatures.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedSignatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-gray-800 truncate flex-1">
                            {sig.name}
                          </h3>
                          <button
                            onClick={() => confirmDelete(sig.id)}
                            className="flex-shrink-0 p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Eliminar assinatura"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="mb-3 p-2 bg-white border border-gray-200 rounded h-32 overflow-hidden relative">
                          <div
                            className="absolute top-0 left-0 origin-top-left pointer-events-none"
                            dangerouslySetInnerHTML={{ __html: sig.thumbnail }}
                            style={{
                              transform: "scale(0.25)",
                              transformOrigin: "top left",
                              width: "400%",
                            }}
                          />
                        </div>

                        <div className="text-xs text-gray-600 mb-3">
                          Guardada em:{" "}
                          {new Date(sig.savedAt).toLocaleDateString("pt-PT")} às{" "}
                          {new Date(sig.savedAt).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => copySavedSignature(sig)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium text-sm"
                            title="Copiar assinatura para colar no Gmail"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600 font-medium">
                      Nenhuma assinatura guardada
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Crie uma assinatura e clique em "Guardar" para começar
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Editor de Assinatura */}
            <TabsContent value="editor" className="mt-0">
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
                      onClick={() =>
                        document.getElementById("file-upload-input")?.click()
                      }
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
                      style={{ outline: "none", height: "532px" }}
                      data-placeholder="Edite a sua assinatura, depois de a carregar"
                    ></div>
                  </div>

                  {processedHtml && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Ruler className="w-5 h-5" />
                        Ajustar Tamanho do Logo
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
                              onChange={(e) =>
                                handleLogoWidthChange(
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              min="10"
                              max="500"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>

                          <button
                            onClick={() =>
                              setAspectRatioLocked(!aspectRatioLocked)
                            }
                            className={`mt-5 p-2 rounded-md transition-colors ${
                              aspectRatioLocked
                                ? "bg-purple-600 text-white hover:bg-purple-700"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                            title={
                              aspectRatioLocked
                                ? "Proporção travada"
                                : "Proporção livre"
                            }
                          >
                            {aspectRatioLocked ? (
                              <Lock className="w-5 h-5" />
                            ) : (
                              <Unlock className="w-5 h-5" />
                            )}
                          </button>

                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Altura (px)
                            </label>
                            <input
                              type="text"
                              value={logoHeight === 0 ? "auto" : logoHeight}
                              readOnly
                              disabled
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <div
                          className="text-purple-700 bg-white/50 p-2 rounded flex items-start gap-2"
                          style={{ fontSize: "14px" }}
                        >
                          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong>Dica:</strong> Dimensões atuais: {logoWidth}
                            x{logoHeight}px
                            {logoWidth > 200 && (
                              <span className="text-orange-600 ml-2 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Logo pode
                                ficar muito grande no Gmail
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {processedHtml && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Palette className="w-5 h-5" />
                        Ajustar Cores
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
                                value={textColor || "#000000"}
                                onChange={(e) => setTextColor(e.target.value)}
                                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={textColor}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setTextColor(value);
                                }}
                                placeholder="#000000"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm uppercase"
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
                                value={separatorColor || "#d4d4d4"}
                                onChange={(e) =>
                                  setSeparatorColor(e.target.value)
                                }
                                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={separatorColor}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSeparatorColor(value);
                                }}
                                placeholder="#d4d4d4"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        {textColor && (
                          <button
                            onClick={applyColorToSelection}
                            className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4" />
                            Aplicar Cor ao Texto Selecionado
                          </button>
                        )}

                        <div
                          className="text-green-700 bg-white/50 p-2 rounded flex items-start gap-2"
                          style={{ fontSize: "14px" }}
                        >
                          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Dica:</strong>{" "}
                            {textColor
                              ? "Selecione o texto na pré-visualização e clique no botão acima para aplicar a cor"
                              : "A cor da barra é aplicada automaticamente"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {imageButtons && imageButtons.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        Substituir Imagens ({imageButtons.length})
                      </label>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {imageButtons}
                      </div>
                    </div>
                  )}

                  {links.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Link2 className="w-5 h-5" />
                        Editar Links ({links.length})
                      </label>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg space-y-3">
                        {links.map((link) => (
                          <div
                            key={link.index}
                            className="bg-white p-3 rounded-md border border-blue-200"
                          >
                            <div className="mb-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Texto:{" "}
                                <span className="font-semibold text-gray-800">
                                  {link.text}
                                </span>
                              </label>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                URL
                              </label>
                              <input
                                type="url"
                                value={link.url}
                                onChange={(e) =>
                                  updateLink(link.index, e.target.value)
                                }
                                placeholder="https://exemplo.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                              />
                            </div>
                          </div>
                        ))}
                        <div
                          className="text-blue-700 bg-white/50 p-2 rounded flex items-start gap-2"
                          style={{ fontSize: "14px" }}
                        >
                          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Dica:</strong> Altere os URLs dos links
                            conforme necessário. As mudanças são aplicadas
                            automaticamente.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita - Preview */}
                <div className="lg:sticky lg:top-12 lg:self-start">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Pré-visualização (Gmail)
                  </label>

                  {/* Botões de ação lado a lado */}
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={copyToClipboard}
                      disabled={!processedHtml}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg font-medium"
                    >
                      {copied ? (
                        <>
                          <Check className="w-5 h-5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          Copiar
                        </>
                      )}
                    </button>

                    {/* Botão para guardar assinatura atual */}
                    {processedHtml && !showSaveDialog && (
                      <button
                        onClick={() => setShowSaveDialog(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md font-medium"
                      >
                        <Save className="w-5 h-5" />
                        Guardar
                      </button>
                    )}
                  </div>

                  {/* Dialog para guardar assinatura */}
                  {processedHtml && showSaveDialog && (
                    <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3 mb-4">
                      <label className="block text-sm font-semibold text-gray-700">
                        Nome da Assinatura
                      </label>
                      <input
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && saveSignature()}
                        placeholder="Ex: Assinatura Corporativa 2024"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveSignature}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveDialog(false);
                            setSignatureName("");
                          }}
                          className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    ref={previewRef}
                    className="p-6 bg-white border-2 border-gray-300 rounded-lg shadow-inner overflow-auto"
                    style={{ height: "532px" }}
                  >
                    {processedHtml ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: processedHtml }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                        <Image className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">
                          A aguardar assinatura
                        </p>
                        <p className="text-sm mt-2">
                          Cole sua assinatura para visualizar
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
