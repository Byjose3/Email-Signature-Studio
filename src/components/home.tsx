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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  footerImageSrc?: string;
  footerImageWidth?: number;
  footerImageHeight?: number;
  disclaimerText?: string;
}

export default function Home() {
  const [processedHtml, setProcessedHtml] = useState("");
  const [originalHtml, setOriginalHtml] = useState(""); // HTML original sem processamento
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [logoWidth, setLogoWidth] = useState<number>(160);
  const [logoHeight, setLogoHeight] = useState<number>(0);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number>(1);
  const [textColor, setTextColor] = useState<string>("");
  const [separatorColor, setSeparatorColor] = useState<string>("");
  const [footerImageSrc, setFooterImageSrc] = useState<string>("");
  const [footerImageWidth, setFooterImageWidth] = useState<number>(400);
  const [footerImageHeight, setFooterImageHeight] = useState<number>(0);
  const [footerAspectRatioLocked, setFooterAspectRatioLocked] = useState(true);
  const [footerOriginalAspectRatio, setFooterOriginalAspectRatio] = useState<number>(1);
  const [links, setLinks] = useState<
    Array<{ text: string; url: string; index: number }>
  >([]);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [signatureName, setSignatureName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("editor");
  const [editingSignatureId, setEditingSignatureId] = useState<string | null>(null);
  const [disclaimerText, setDisclaimerText] = useState<string>("");
  const [backupSignatures, setBackupSignatures] = useState<
    Array<{ name: string; html: string }>
  >([]);
  const [showBackupPickerDialog, setShowBackupPickerDialog] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);
  const savedCursorRange = useRef<Range | null>(null);
  const savedInsertChildIndex = useRef<number | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  // Flag to prevent useEffect from overwriting the DOM while user is editing
  const isUserEditingRef = useRef<boolean>(false);
  // Safety timer to force-release isUserEditingRef after max 2s (prevents permanent lock)
  const userEditingSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp of last direct canvas edit (to prevent useEffect overwrite within 1s)
  const lastDirectEditTimestampRef = useRef<number>(0);
  // Debounce timer for syncing state after user stops typing
  const syncStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag to prevent onBlur from syncing state during footer image insertion
  const isInsertingFooterRef = useRef<boolean>(false);

  // Helper: set isUserEditingRef with a safety timeout that forces release after 2s
  const setUserEditing = (value: boolean) => {
    if (value) {
      isUserEditingRef.current = true;
      // Clear any existing safety timer
      if (userEditingSafetyTimerRef.current) {
        clearTimeout(userEditingSafetyTimerRef.current);
      }
      // Force-release after 2 seconds no matter what
      userEditingSafetyTimerRef.current = setTimeout(() => {
        isUserEditingRef.current = false;
        userEditingSafetyTimerRef.current = null;
      }, 2000);
    } else {
      isUserEditingRef.current = false;
      if (userEditingSafetyTimerRef.current) {
        clearTimeout(userEditingSafetyTimerRef.current);
        userEditingSafetyTimerRef.current = null;
      }
    }
  };

  useEffect(() => {
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

  // Importa assinaturas de um ficheiro de backup HTML
  const handleBackupFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");

      // Tenta extrair assinaturas do formato de backup
      const sections = doc.querySelectorAll(".signature-section");

      if (sections.length === 0) {
        // Não é um ficheiro de backup — tenta carregar directamente como assinatura
        setTextColor("");
        setSeparatorColor("");
        setDisclaimerText("");
        setOriginalHtml(content);
        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = content;
        }
        processHtml(content, undefined, undefined);
        setActiveTab("editor");
        setSuccessMessage("Assinatura carregada no editor!");
        setTimeout(() => setSuccessMessage(""), 3000);
        return;
      }

      const extracted: Array<{ name: string; html: string }> = [];

      sections.forEach((section) => {
        // Extrai o nome da assinatura (remove o número inicial "N. ")
        const h2 = section.querySelector("h2");
        const rawName = h2?.textContent?.trim() ?? "Assinatura";
        const name = rawName.replace(/^\d+\.\s*/, "");

        // Extrai o HTML da assinatura
        const container = section.querySelector(".signature-container");
        const html = container?.innerHTML?.trim() ?? "";

        if (html) {
          extracted.push({ name, html });
        }
      });

      if (extracted.length === 0) {
        setError("Não foi possível extrair assinaturas do ficheiro de backup.");
        setTimeout(() => setError(""), 4000);
        return;
      }

      if (extracted.length === 1) {
        // Carrega directamente no editor
        const sig = extracted[0];
        setTextColor("");
        setSeparatorColor("");
        setDisclaimerText("");
        setOriginalHtml(sig.html);
        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = sig.html;
        }
        processHtml(sig.html, undefined, undefined);
        setSignatureName(sig.name);
        setEditingSignatureId(null);
        setActiveTab("editor");
        setSuccessMessage(`"${sig.name}" carregada no editor!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        // Mostra picker para o utilizador escolher
        setBackupSignatures(extracted);
        setShowBackupPickerDialog(true);
      }
    };
    reader.readAsText(file);
  };

  // Carrega uma assinatura extraída do backup no editor
  const loadBackupSignature = (sig: { name: string; html: string }) => {
    setTextColor("");
    setSeparatorColor("");
    setDisclaimerText("");
    setOriginalHtml(sig.html);
    if (pasteAreaRef.current) {
      pasteAreaRef.current.innerHTML = sig.html;
    }
    processHtml(sig.html, undefined, undefined);
    setSignatureName(sig.name);
    setEditingSignatureId(null);
    setShowBackupPickerDialog(false);
    setActiveTab("editor");
    setSuccessMessage(`"${sig.name}" carregada no editor!`);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  // Remove cores inline do HTML para manter o original sem customizações
  const removeInlineColors = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Força cor preta APENAS em elementos de texto visível (não estruturais)
    const textElements = doc.querySelectorAll(
      "span, div, p, b, strong, i, em, h1, h2, h3, h4, h5, h6",
    );
    textElements.forEach((el) => {
      const element = el as HTMLElement;
      // Só aplica cor se NÃO for um link e tiver texto
      if (
        element.tagName !== "A" &&
        element.textContent &&
        element.textContent.trim()
      ) {
        // FORÇA cor preta para sobrescrever qualquer cor inline
        element.style.color = "#000000";
      }
    });

    return doc.body.innerHTML;
  };

  // ── DISCLAIMER HELPERS (definidos cedo para serem usados em loadSignature) ───

  /** Constrói o bloco HTML para o disclaimer */
  const buildDisclaimerHtml = (text: string): string => {
    if (!text.trim()) return "";
    const htmlText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    return `<table border="0" cellpadding="0" cellspacing="0" role="presentation" data-disclaimer-block="true" style="border-collapse:collapse;border-spacing:0;margin-top:32px;width:100%;max-width:600px;"><tbody><tr><td style="padding:10px 0 0 0;border-top:1px solid #e0e0e0;font-family:Arial,sans-serif;font-size:10px;line-height:1.5;color:#888888;" valign="top">${htmlText}</td></tr></tbody></table>`;
  };

  /** Injeta / actualiza / remove o disclaimer no HTML processado */
  const applyDisclaimerToHtml = (html: string, text: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const existing = doc.querySelector('[data-disclaimer-block="true"]');
    if (existing) existing.remove();
    if (!text.trim()) return doc.body.innerHTML;
    doc.body.insertAdjacentHTML("beforeend", buildDisclaimerHtml(text));
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
      // Guarda o HTML editado do preview (pode ter sido editado pelo user)
      const editedHtml = previewRef.current?.innerHTML || processedHtml;

      // Cria thumbnail usando o mesmo HTML
      const thumbnail = editedHtml;

      const newSignature: SavedSignature = {
        id: editingSignatureId ?? Date.now().toString(),
        name: signatureName.trim(),
        html: editedHtml, // Guarda HTML editado do preview
        thumbnail,
        savedAt: new Date().toISOString(),
        logoWidth,
        logoHeight,
        textColor,
        separatorColor,
        footerImageSrc,
        footerImageWidth,
        footerImageHeight,
        disclaimerText,
      };

      const updated = editingSignatureId
        ? savedSignatures.map((s) => s.id === editingSignatureId ? newSignature : s)
        : [...savedSignatures, newSignature];
      setSavedSignatures(updated);
      localStorage.setItem("emailSignatures", JSON.stringify(updated));

      setSignatureName("");
      setShowSaveDialog(false);
      setError("");
      setEditingSignatureId(null);

      // LIMPA TODOS OS ESTADOS após guardar (para permitir carregar nova assinatura)
      setProcessedHtml("");
      setOriginalHtml("");
      if (pasteAreaRef.current) {
        pasteAreaRef.current.innerHTML = "";
      }
      if (previewRef.current) {
        previewRef.current.innerHTML = "";
      }

      // Reset de cores
      setTextColor("");
      setSeparatorColor("");

      // Reset de dimensões do logo
      setLogoWidth(0);
      setLogoHeight(0);
      setOriginalAspectRatio(1);

      // Reset de imagem de rodapé
      setFooterImageSrc("");
      setFooterImageWidth(400);
      setFooterImageHeight(0);
      setFooterOriginalAspectRatio(1);

      // Reset de disclaimer
      setDisclaimerText("");

      // Reset dos links editáveis (limpa campos de links da UI)
      setLinks([]);

      // Mostra mensagem de sucesso
      setSuccessMessage(editingSignatureId ? "Assinatura atualizada com sucesso!" : "Assinatura guardada com sucesso!");
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
    // Guarda HTML original
    setOriginalHtml(signature.html);

    // Coloca o HTML original no pasteArea
    if (pasteAreaRef.current) {
      pasteAreaRef.current.innerHTML = signature.html;
    }

    // Carrega as cores guardadas
    setLogoWidth(signature.logoWidth);
    setLogoHeight(signature.logoHeight);
    setTextColor(signature.textColor);
    setSeparatorColor(signature.separatorColor);
    setFooterImageSrc(signature.footerImageSrc ?? "");
    setFooterImageWidth(signature.footerImageWidth ?? 400);
    setFooterImageHeight(signature.footerImageHeight ?? 0);
    setDisclaimerText(signature.disclaimerText ?? "");

    // Processa o HTML com as cores guardadas para mostrar no preview
    const processed = processHtml(
      signature.html,
      signature.textColor,
      signature.separatorColor,
    );
    if (processed) {
      let final = processed;

      // Aplica a imagem de rodapé se existir
      const footerSrc = signature.footerImageSrc ?? "";
      const footerW = signature.footerImageWidth ?? 400;
      const footerH = signature.footerImageHeight ?? 0;
      if (footerSrc) {
        final = applyFooterImageToHtml(final, footerSrc, footerW, footerH);
      }

      // Aplica o disclaimer se existir
      const disclaimerToApply = signature.disclaimerText ?? "";
      if (disclaimerToApply) {
        final = applyDisclaimerToHtml(final, disclaimerToApply);
      }

      setProcessedHtml(final);
    }
  };

  // Edita uma assinatura guardada — carrega no editor e muda para a aba editor
  const editSavedSignature = (signature: SavedSignature) => {
    loadSignature(signature);
    setEditingSignatureId(signature.id);
    setSignatureName(signature.name);
    setActiveTab("editor");
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

      // Cria elemento temporário para copiar
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlToCopy;
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      // Tenta usar a API moderna do Clipboard (preserva formatação melhor)
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlToCopy], { type: 'text/html' }),
            'text/plain': new Blob([tempDiv.innerText], { type: 'text/plain' })
          })
        ]);

        document.body.removeChild(tempDiv);
        setSuccessMessage("Assinatura copiada! Cole diretamente no Gmail.");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (clipboardErr) {
        // Fallback: usa método antigo se a API moderna falhar
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
      }
    } catch (err) {
      setError("Erro ao copiar assinatura.");
      setTimeout(() => setError(""), 3000);
    }
  };

  // Exporta uma assinatura específica para HTML
  const exportSignatureAsHTML = (signature: SavedSignature) => {
    const savedDate = new Date(signature.savedAt).toLocaleDateString("pt-PT");
    const savedTime = new Date(signature.savedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

    const htmlContent = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${signature.name}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f2f5;
            min-height: 100vh;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 40px 20px;
        }
        .container {
            max-width: 780px;
            width: 100%;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.10);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1a56db 0%, #1e429f 100%);
            padding: 28px 32px 24px;
            color: white;
        }
        .header h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 4px;
            letter-spacing: -0.3px;
        }
        .header .meta {
            font-size: 13px;
            opacity: 0.75;
        }
        .steps {
            background: #eff6ff;
            border-bottom: 1px solid #dbeafe;
            padding: 18px 32px;
            display: flex;
            align-items: center;
            gap: 0;
        }
        .step {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }
        .step-num {
            width: 28px;
            height: 28px;
            background: #1a56db;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .step-text {
            font-size: 13px;
            color: #1e3a5f;
            line-height: 1.35;
        }
        .step-text strong {
            display: block;
            font-weight: 700;
        }
        .step-arrow {
            font-size: 18px;
            color: #93c5fd;
            padding: 0 8px;
            flex-shrink: 0;
        }
        .copy-section {
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .copy-btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 13px 28px;
            background: #1a56db;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.1px;
            transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
            box-shadow: 0 2px 8px rgba(26,86,219,0.30);
            flex-shrink: 0;
        }
        .copy-btn:hover {
            background: #1648c0;
            box-shadow: 0 4px 14px rgba(26,86,219,0.38);
            transform: translateY(-1px);
        }
        .copy-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(26,86,219,0.20);
        }
        .copy-btn svg { flex-shrink: 0; }
        .feedback {
            font-size: 14px;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 6px;
            opacity: 0;
            transition: opacity 0.25s;
            pointer-events: none;
        }
        .feedback.show { opacity: 1; }
        .feedback.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .feedback.error   { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .hint {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.4;
        }
        .preview-label {
            padding: 14px 32px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: #9ca3af;
        }
        .signature-container {
            padding: 24px 32px 32px;
        }
        .signature-container table { margin: 0; }
    </style>
</head>
<body>
    <div class="container">

        <div class="header">
            <h1>${signature.name}</h1>
            <div class="meta">Guardada em ${savedDate} às ${savedTime}</div>
        </div>

        <div class="steps">
            <div class="step">
                <div class="step-num">1</div>
                <div class="step-text"><strong>Copiar</strong>Clique no botão azul</div>
            </div>
            <div class="step-arrow">›</div>
            <div class="step">
                <div class="step-num">2</div>
                <div class="step-text"><strong>Abrir Gmail</strong>Ir a Definições → Assinatura</div>
            </div>
            <div class="step-arrow">›</div>
            <div class="step">
                <div class="step-num">3</div>
                <div class="step-text"><strong>Colar</strong>Ctrl+V no campo de assinatura</div>
            </div>
        </div>

        <div class="copy-section">
            <button class="copy-btn" id="copyBtn" onclick="copySignature()">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                Copiar Assinatura
            </button>
            <div class="feedback" id="feedback"></div>
            <div class="hint">A assinatura é copiada com toda a formatação,<br>imagens e cores intactas.</div>
        </div>

        <div class="preview-label">Pré-visualização da assinatura</div>
        <div class="signature-container" id="signatureContent">
            ${signature.html}
        </div>

    </div>
    <script>
        async function copySignature() {
            const el = document.getElementById('signatureContent');
            const btn = document.getElementById('copyBtn');
            const fb = document.getElementById('feedback');

            try {
                // Método moderno: preserva HTML + formatação
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html':  new Blob([el.innerHTML],  { type: 'text/html' }),
                        'text/plain': new Blob([el.innerText],  { type: 'text/plain' })
                    })
                ]);
                showFeedback(fb, btn, true);
            } catch (e) {
                // Fallback: selecção clássica
                try {
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    const ok = document.execCommand('copy');
                    sel.removeAllRanges();
                    showFeedback(fb, btn, ok);
                } catch (e2) {
                    showFeedback(fb, btn, false);
                }
            }
        }

        function showFeedback(fb, btn, success) {
            if (success) {
                fb.textContent = '✓ Copiado! Agora cole no Gmail (Ctrl+V)';
                fb.className = 'feedback success show';
                btn.style.background = '#16a34a';
                btn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg> Copiado!";
            } else {
                fb.textContent = '✗ Erro ao copiar. Selecione manualmente e use Ctrl+C.';
                fb.className = 'feedback error show';
            }
            setTimeout(() => {
                fb.className = 'feedback';
                btn.style.background = '';
                btn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg> Copiar Assinatura";
            }, 3500);
        }
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileName = signature.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.download = `${fileName}-${new Date().toISOString().split("T")[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Exporta todas as assinaturas individualmente, uma a uma
  const exportAllSignatures = () => {
    if (savedSignatures.length === 0) {
      setError("Não há assinaturas para exportar.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    savedSignatures.forEach((sig, index) => {
      setTimeout(() => {
        exportSignatureAsHTML(sig);
      }, index * 400); // 400ms de intervalo entre cada download
    });

    setSuccessMessage(
      `A descarregar ${savedSignatures.length} assinatura(s) individualmente...`,
    );
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // Exporta todas as assinaturas para HTML (backup) — mantido para compatibilidade interna
  const exportAllSignaturesAsBackup = () => {
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-icon">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          <span>Copiar Assinatura</span>
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
            padding: 16px 0 16px 16px;
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
        .copy-button svg {
            flex-shrink: 0;
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
            // Garante que pegamos o botão, mesmo se clicar no SVG ou span
            const button = event.target.closest('.copy-button');

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
                button.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg><span>Copiado!</span>";
                button.style.background = '#28a745';

                // Reset após 3 segundos
                setTimeout(() => {
                    feedbackElement.className = 'copy-feedback';
                    button.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='copy-icon'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg><span>Copiar Assinatura</span>";
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

  // DESATIVADO: Este useEffect reprocessava o HTML destruindo cores aplicadas manualmente
  // A aplicação de cores agora é feita via applyColorToSelection sem reprocessar
  // useEffect(() => {
  //   if (originalHtml && originalHtml.trim() !== "") {
  //     const currentHtml = previewRef.current?.innerHTML || "";
  //     const hasBeenManuallyEdited =
  //       processedHtml &&
  //       currentHtml &&
  //       currentHtml !== processedHtml &&
  //       currentHtml.trim() !== "";
  //
  //     const sourceHtml = hasBeenManuallyEdited ? currentHtml : originalHtml;
  //
  //     const processed = processHtml(
  //       sourceHtml,
  //       textColor || undefined,
  //       separatorColor || undefined,
  //     );
  //     if (processed && processed !== processedHtml) {
  //       setProcessedHtml(processed);
  //     }
  //   }
  // }, [textColor, separatorColor, originalHtml]);

  // Atualiza o preview ref quando processedHtml muda (aplicação de cores)
  // Ignora quando o user está a editar diretamente (evita restaurar conteúdo apagado)
  useEffect(() => {
    // Se o user está a editar ou a inserir imagem de rodapé, nunca sobrepor o DOM
    if (isUserEditingRef.current) return;
    if (isInsertingFooterRef.current) return;
    // Protecção adicional: não sobrescrever o DOM durante 1.5s após a última edição directa no canvas
    if (Date.now() - lastDirectEditTimestampRef.current < 1500) return;
    if (processedHtml && previewRef.current) {
      // Só atualiza se o conteúdo for diferente (evita loop)
      const currentHtml = previewRef.current.innerHTML;
      if (currentHtml !== processedHtml) {
        previewRef.current.innerHTML = processedHtml;
      }
    }
  }, [processedHtml]);

  // Quando a tab muda para "editor", garante que o previewRef é preenchido
  // (pode estar null quando o processedHtml foi definido enquanto a tab estava fechada)
  useEffect(() => {
    if (activeTab === "editor" && processedHtml) {
      // Aguarda o próximo tick para que o DOM da tab esteja montado
      setTimeout(() => {
        if (previewRef.current && previewRef.current.innerHTML !== processedHtml) {
          previewRef.current.innerHTML = processedHtml;
        }
        if (pasteAreaRef.current && originalHtml && pasteAreaRef.current.innerHTML !== originalHtml) {
          pasteAreaRef.current.innerHTML = originalHtml;
        }
      }, 0);
    }
  }, [activeTab]);

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
            nodesToRemove.forEach((node) => node.parentNode?.removeChild(node));

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

          // Não adiciona espaços &nbsp; extras - o espaçamento já vem do HTML original
          // O margin-right CSS inline é suficiente para o espaçamento visual
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
          nodesToRemove.forEach((node) => node.parentNode?.removeChild(node));

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

          // Calcula e guarda aspect ratio original se a imagem estiver carregada
          if (
            imgElement.complete &&
            imgElement.naturalWidth &&
            imgElement.naturalHeight
          ) {
            const ratio = imgElement.naturalWidth / imgElement.naturalHeight;
            setOriginalAspectRatio(ratio);

            // Calcula height baseado no aspect ratio para manter proporções
            // Isso evita que o Gmail permita redimensionar o logo
            if (!height || height === 0) {
              height = Math.round(width / ratio);
            }
          }

          // Define dimensões iniciais no estado — calcula height explícito a partir do aspect ratio
          setLogoWidth(width);
          // Se temos aspect ratio, calcula height explícito para forçar dimensões em todos os clientes
          const computedHeight = (originalAspectRatio > 0 && imgElement.complete && imgElement.naturalWidth)
            ? Math.round(width / (imgElement.naturalWidth / imgElement.naturalHeight))
            : (height > 0 ? height : 0);
          setLogoHeight(computedHeight);

          // Aplica width E height explícitos — clientes como Outlook, Apple Mail ignoram "auto"
          img.setAttribute("width", String(width));
          if (computedHeight > 0) {
            img.setAttribute("height", String(computedHeight));
            img.style.height = `${computedHeight}px`;
            img.style.maxHeight = `${computedHeight}px`;
            img.style.minHeight = `${computedHeight}px`;
          } else {
            img.removeAttribute("height");
            img.style.removeProperty("height");
          }
          img.style.width = `${width}px`;
          img.style.maxWidth = `${width}px`;
          img.style.minWidth = `${width}px`;
          img.style.display = "block";
          img.style.border = "0";
          img.style.outline = "none";

          // Encontra a célula da tabela que contém o logo
          let parentCell = img.parentElement;
          while (parentCell && parentCell.tagName !== "TD") {
            parentCell = parentCell.parentElement;
          }

          if (parentCell) {
            // Define width fixo na célula igual ao do logo — força clientes a respeitar
            const parentCellElement = parentCell as HTMLElement;
            parentCellElement.setAttribute("width", String(width));
            parentCellElement.style.width = `${width}px`;
            parentCellElement.style.minWidth = `${width}px`;
            parentCellElement.style.maxWidth = `${width}px`;
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
          // Para outras imagens (ícones sociais e imagens de conteúdo): mantém e reforça dimensões
          const width = img.getAttribute("width") || img.style.width;
          const height = img.getAttribute("height") || img.style.height;

          if (width) {
            const wv = parseInt(width.toString().replace("px", ""));
            if (!isNaN(wv) && wv > 0) {
              img.setAttribute("width", String(wv));
              img.style.width = `${wv}px`;
              img.style.maxWidth = `${wv}px`;
              img.style.minWidth = `${wv}px`;
            }
          }
          if (height) {
            const hv = parseInt(height.toString().replace("px", ""));
            if (!isNaN(hv) && hv > 0) {
              img.setAttribute("height", String(hv));
              img.style.height = `${hv}px`;
              img.style.maxHeight = `${hv}px`;
              img.style.minHeight = `${hv}px`;
            }
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

        // Remove TODOS os margins e paddings para evitar espaços em branco extras
        divElement.style.margin = "0";
        divElement.style.padding = "0";
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
              // Copia TODOS os estilos inline do elemento pai (incluindo cor!)
              strong.style.cssText = htmlElement.style.cssText;
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

        // Aplica customTextColor aos elementos de texto se fornecido
        if (customTextColor) {
          const isTextElement =
            htmlElement.tagName === "SPAN" ||
            htmlElement.tagName === "DIV" ||
            htmlElement.tagName === "P" ||
            htmlElement.tagName === "B" ||
            htmlElement.tagName === "STRONG" ||
            htmlElement.tagName === "I" ||
            htmlElement.tagName === "EM";

          // Aplica cor apenas se for elemento de texto e não for link
          if (
            isTextElement &&
            htmlElement.tagName !== "A" &&
            htmlElement.textContent &&
            htmlElement.textContent.trim()
          ) {
            // NÃO sobrescreve cores inline já existentes (preserva formatação manual)
            if (!htmlElement.style.color) {
              htmlElement.style.color = customTextColor;
            }
          }
        }

        // Remove estilos problemáticos para Gmail (mas NÃO em imagens — dimensões são geridas separadamente)
        if (htmlElement.tagName !== "IMG") {
          htmlElement.style.removeProperty("max-width");
          htmlElement.style.removeProperty("max-height");
        }
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

        // Remove TODOS os margins e paddings para evitar espaços em branco extras
        pElement.style.margin = "0";
        pElement.style.padding = "0";

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

      // Aplica a imagem de rodapé se já existir
      let finalProcessed = footerImageSrc
        ? applyFooterImageToHtml(processed, footerImageSrc, footerImageWidth, footerImageHeight)
        : processed;

      // Aplica disclaimer se já existir um definido
      finalProcessed = disclaimerText
        ? applyDisclaimerToHtml(finalProcessed, disclaimerText)
        : finalProcessed;

      setProcessedHtml(finalProcessed);
      return finalProcessed;
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
      setDisclaimerText("");

      if (htmlData) {
        // Guarda HTML original
        setOriginalHtml(htmlData);

        // Limpa a área de paste com HTML original
        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = htmlData;
        }
        processHtml(htmlData, undefined, undefined);
      } else if (textData) {
        setOriginalHtml(textData);

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
        // Atualiza o HTML original com a versão editada
        setOriginalHtml(currentContent);

        // Processa para o preview SEM aplicar cores customizadas
        processHtml(currentContent, undefined, undefined);
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
      setDisclaimerText("");

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;

        // Guarda HTML original
        setOriginalHtml(content);

        if (pasteAreaRef.current) {
          pasteAreaRef.current.innerHTML = content;
        }
        processHtml(content, undefined, undefined);
      };
      reader.readAsText(file);
    } else {
      setError("Por favor, selecione um arquivo HTML válido (.html ou .htm).");
      setTimeout(() => setError(""), 3000);
    }
  };

  /**
   * Comprime uma imagem usando Canvas API.
   * - Reduz dimensões se excederem maxWidth/maxHeight
   * - Converte para JPEG (ou PNG se tiver transparência) com qualidade configurável
   * Retorna uma Promise com o data URI comprimido.
   */
  const compressImage = (
    file: File,
    maxWidth = 600,
    maxHeight = 300,
    quality = 0.82,
  ): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          let { naturalWidth: w, naturalHeight: h } = img;

          // Reduz proporcionalmente se necessário
          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);

          // PNG para imagens com transparência (PNG original), JPEG para o resto
          const isPng = file.type === "image/png";
          const compressed = isPng
            ? canvas.toDataURL("image/png") // PNG mantém transparência mas sem redução de qualidade
            : canvas.toDataURL("image/jpeg", quality);

          resolve(compressed);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (
    imageId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      compressImage(file, 800, 400, 0.82).then((base64) => {
        // Carregar a imagem comprimida para obter dimensões reais pós-compressão
        const imageElement = document.createElement("img");
        imageElement.onload = () => {
          const naturalWidth = imageElement.naturalWidth;
          const naturalHeight = imageElement.naturalHeight;

          // Calcular aspect ratio da nova imagem
          const aspectRatio = naturalWidth / naturalHeight;
          setOriginalAspectRatio(aspectRatio);

          // Se for o logo (img-0), atualizar dimensões mantendo aspect ratio
          if (imageId === "img-0") {
            const newWidth = logoWidth > 0 ? logoWidth : 160;
            const newNaturalRatio = naturalWidth > 0 && naturalHeight > 0
              ? naturalWidth / naturalHeight
              : originalAspectRatio;
            const newHeight = newNaturalRatio > 0 ? Math.round(newWidth / newNaturalRatio) : 0;

            setLogoWidth(newWidth);
            setLogoHeight(newHeight);
            if (newNaturalRatio > 0) setOriginalAspectRatio(newNaturalRatio);

            // Usa o DOM vivo (source of truth) para preservar edições manuais do utilizador
            const sourceHtml = previewRef.current ? previewRef.current.innerHTML : processedHtml;
            const parser = new DOMParser();
            const doc = parser.parseFromString(sourceHtml, "text/html");
            const img = doc.querySelector(`img[data-image-id="${imageId}"]`);

            if (img) {
              img.setAttribute("src", base64);
              img.setAttribute("width", String(newWidth));
              if (newHeight > 0) {
                img.setAttribute("height", String(newHeight));
                (img as HTMLElement).style.height = `${newHeight}px`;
                (img as HTMLElement).style.maxHeight = `${newHeight}px`;
                (img as HTMLElement).style.minHeight = `${newHeight}px`;
              } else {
                img.removeAttribute("height");
                (img as HTMLElement).style.removeProperty("height");
              }
              (img as HTMLElement).style.width = `${newWidth}px`;
              (img as HTMLElement).style.maxWidth = `${newWidth}px`;
              (img as HTMLElement).style.minWidth = `${newWidth}px`;
              (img as HTMLElement).style.display = "block";
              (img as HTMLElement).style.border = "0";
              (img as HTMLElement).style.outline = "none";

              const newHtml = doc.body.innerHTML;
              setUserEditing(true);
              setProcessedHtml(newHtml);
              if (previewRef.current) previewRef.current.innerHTML = newHtml;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setUserEditing(false);
                });
              });

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
                  pasteImg.setAttribute("width", String(newWidth));
                  if (newHeight > 0) {
                    pasteImg.setAttribute("height", String(newHeight));
                    (pasteImg as HTMLElement).style.height = `${newHeight}px`;
                    (pasteImg as HTMLElement).style.maxHeight = `${newHeight}px`;
                    (pasteImg as HTMLElement).style.minHeight = `${newHeight}px`;
                  } else {
                    pasteImg.removeAttribute("height");
                    (pasteImg as HTMLElement).style.removeProperty("height");
                  }
                  (pasteImg as HTMLElement).style.width = `${newWidth}px`;
                  (pasteImg as HTMLElement).style.maxWidth = `${newWidth}px`;
                  (pasteImg as HTMLElement).style.minWidth = `${newWidth}px`;
                  (pasteImg as HTMLElement).style.display = "block";
                  (pasteImg as HTMLElement).style.border = "0";
                  (pasteImg as HTMLElement).style.outline = "none";

                  pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML;
                }
              }
            }
          } else {
            // Usa o DOM vivo (source of truth) para preservar edições manuais do utilizador
            const sourceHtml = previewRef.current ? previewRef.current.innerHTML : processedHtml;
            const parser = new DOMParser();
            const doc = parser.parseFromString(sourceHtml, "text/html");
            const img = doc.querySelector(`img[data-image-id="${imageId}"]`);

            if (img) {
              img.setAttribute("src", base64);
              const newHtml = doc.body.innerHTML;
              setUserEditing(true);
              setProcessedHtml(newHtml);
              if (previewRef.current) previewRef.current.innerHTML = newHtml;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setUserEditing(false);
                });
              });

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
          }

          imageElement.src = base64;
        };

        imageElement.src = base64;
      });
    } else {
      setError("Por favor, selecione uma imagem válida.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleImageUrlChange = (imageId: string, newUrl: string) => {
    if (!newUrl || !newUrl.trim()) return;
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.startsWith("//")) return;

    // Usa o DOM vivo (source of truth) para preservar edições manuais do utilizador
    const sourceHtml = previewRef.current ? previewRef.current.innerHTML : processedHtml;
    const parser = new DOMParser();
    const doc = parser.parseFromString(sourceHtml, "text/html");
    const img = doc.querySelector(`img[data-image-id="${imageId}"]`);

    if (img) {
      img.setAttribute("src", trimmedUrl);
      const newHtml = doc.body.innerHTML;
      setUserEditing(true);
      setProcessedHtml(newHtml);
      if (previewRef.current) previewRef.current.innerHTML = newHtml;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUserEditing(false);
        });
      });

      if (pasteAreaRef.current) {
        const pasteDoc = parser.parseFromString(pasteAreaRef.current.innerHTML, "text/html");
        const pasteImg = pasteDoc.querySelector(`img[data-image-id="${imageId}"]`);
        if (pasteImg) {
          pasteImg.setAttribute("src", trimmedUrl);
          pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML;
        }
      }
    }
  };

  const handleSocialLinkUpdate = (imageId: string, newLink: string) => {
    // Atualiza o DOM do preview diretamente (sem re-render)
    if (previewRef.current) {
      const previewImg = previewRef.current.querySelector(
        `img[data-image-id="${imageId}"]`,
      ) as HTMLImageElement | null;
      if (previewImg) {
        previewImg.setAttribute("data-social-link", newLink);
        const previewImgParent = previewImg.parentNode as HTMLElement | null;
        if (previewImgParent && previewImgParent.tagName === "A") {
          if (newLink && newLink.trim() !== "") {
            (previewImgParent as HTMLAnchorElement).href = newLink;
          }
        }
      }
    }

    // Debounce o setProcessedHtml para não interromper a escrita
    setUserEditing(true);
    if (syncStateTimerRef.current) {
      clearTimeout(syncStateTimerRef.current);
    }
    syncStateTimerRef.current = setTimeout(() => {
      // Usa o HTML actual do previewRef (evita stale closure)
      const currentHtml = previewRef.current
        ? previewRef.current.innerHTML
        : processedHtml;
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, "text/html");
      const img = doc.querySelector(`img[data-image-id="${imageId}"]`);

      if (img) {
        img.setAttribute("data-social-link", newLink);
        const imgParent = img.parentNode as HTMLElement | null;
        if (imgParent && imgParent.tagName === "A") {
          if (newLink && newLink.trim() !== "") {
            (imgParent as HTMLAnchorElement).href = newLink;
          } else {
            imgParent.parentNode?.replaceChild(img, imgParent);
          }
        } else if (newLink && newLink.trim() !== "") {
          const link = doc.createElement("a");
          link.href = newLink;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.style.display = "inline-block";
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
            const pasteImgParent = pasteImg.parentNode as HTMLElement | null;
            if (pasteImgParent && pasteImgParent.tagName === "A") {
              if (newLink && newLink.trim() !== "") {
                (pasteImgParent as HTMLAnchorElement).href = newLink;
              } else {
                pasteImgParent.parentNode?.replaceChild(pasteImg, pasteImgParent);
              }
            } else if (newLink && newLink.trim() !== "") {
              const pasteLink = pasteDoc.createElement("a");
              pasteLink.href = newLink;
              pasteLink.target = "_blank";
              pasteLink.rel = "noopener noreferrer";
              pasteLink.style.display = "inline-block";
              pasteImgParent?.replaceChild(pasteLink, pasteImg);
              pasteLink.appendChild(pasteImg);
            }
            pasteAreaRef.current.innerHTML = pasteDoc.body.innerHTML;
          }
        }
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUserEditing(false);
        });
      });
    }, 600);
  };

  const updateLogoSize = (width: number, height: number) => {
    // Usa o DOM vivo (source of truth) para preservar edições manuais do utilizador
    const sourceHtml = previewRef.current ? previewRef.current.innerHTML : processedHtml;
    const parser = new DOMParser();
    const doc = parser.parseFromString(sourceHtml, "text/html");
    const logo = doc.querySelector('img[data-image-id="img-0"]');

    if (logo) {
      // Calcula height real a partir do aspect ratio se não foi especificado
      const effectiveHeight = height > 0
        ? height
        : (originalAspectRatio > 0 ? Math.round(width / originalAspectRatio) : 0);

      logo.setAttribute("width", String(width));
      if (effectiveHeight > 0) {
        logo.setAttribute("height", String(effectiveHeight));
        (logo as HTMLElement).style.height = `${effectiveHeight}px`;
        (logo as HTMLElement).style.maxHeight = `${effectiveHeight}px`;
        (logo as HTMLElement).style.minHeight = `${effectiveHeight}px`;
      } else {
        logo.removeAttribute("height");
        (logo as HTMLElement).style.removeProperty("height");
        (logo as HTMLElement).style.removeProperty("maxHeight");
        (logo as HTMLElement).style.removeProperty("minHeight");
      }
      (logo as HTMLElement).style.width = `${width}px`;
      (logo as HTMLElement).style.maxWidth = `${width}px`;
      (logo as HTMLElement).style.minWidth = `${width}px`;
      (logo as HTMLElement).style.display = "block";
      (logo as HTMLElement).style.border = "0";
      (logo as HTMLElement).style.outline = "none";

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

        // Define célula do logo COM width fixo igual ao da imagem (força clientes a respeitar)
        (parentCell as HTMLElement).style.width = `${width}px`;
        (parentCell as HTMLElement).style.minWidth = `${width}px`;
        (parentCell as HTMLElement).style.maxWidth = `${width}px`;
        (parentCell as HTMLElement).setAttribute("width", String(width));
        (parentCell as HTMLElement).style.paddingRight = "0"; // Sem padding direito na célula do logo
        (parentCell as HTMLElement).style.paddingLeft = "0";
        (parentCell as HTMLElement).style.paddingTop = "0";
        (parentCell as HTMLElement).style.paddingBottom = "0";
        (parentCell as HTMLElement).style.verticalAlign = "top";
        (parentCell as HTMLElement).setAttribute("valign", "top");
      }

      const newHtml = doc.body.innerHTML;
      setUserEditing(true);
      setProcessedHtml(newHtml);
      if (previewRef.current) previewRef.current.innerHTML = newHtml;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUserEditing(false);
        });
      });

      // Atualiza também a área de paste
      if (pasteAreaRef.current) {
        const pasteDoc = parser.parseFromString(
          pasteAreaRef.current.innerHTML,
          "text/html",
        );
        const pasteLogo = pasteDoc.querySelector('img[data-image-id="img-0"]');
        if (pasteLogo) {
          // Calcula height real a partir do aspect ratio se não foi especificado
          const effectiveHeightPaste = height > 0
            ? height
            : (originalAspectRatio > 0 ? Math.round(width / originalAspectRatio) : 0);

          pasteLogo.setAttribute("width", String(width));
          if (effectiveHeightPaste > 0) {
            pasteLogo.setAttribute("height", String(effectiveHeightPaste));
            (pasteLogo as HTMLElement).style.height = `${effectiveHeightPaste}px`;
            (pasteLogo as HTMLElement).style.maxHeight = `${effectiveHeightPaste}px`;
            (pasteLogo as HTMLElement).style.minHeight = `${effectiveHeightPaste}px`;
          } else {
            pasteLogo.removeAttribute("height");
            (pasteLogo as HTMLElement).style.removeProperty("height");
          }
          (pasteLogo as HTMLElement).style.width = `${width}px`;
          (pasteLogo as HTMLElement).style.maxWidth = `${width}px`;
          (pasteLogo as HTMLElement).style.minWidth = `${width}px`;
          (pasteLogo as HTMLElement).style.display = "block";
          (pasteLogo as HTMLElement).style.border = "0";
          (pasteLogo as HTMLElement).style.outline = "none";

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

            // Define célula do logo COM width fixo (força clientes a respeitar)
            (pasteParentCell as HTMLElement).style.width = `${width}px`;
            (pasteParentCell as HTMLElement).style.minWidth = `${width}px`;
            (pasteParentCell as HTMLElement).style.maxWidth = `${width}px`;
            (pasteParentCell as HTMLElement).setAttribute("width", String(width));
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

    // Calcula height a partir do aspect ratio para manter proporções em todos os clientes
    const computedHeight = originalAspectRatio > 0 ? Math.round(newWidth / originalAspectRatio) : 0;
    setLogoHeight(computedHeight);
    updateLogoSize(newWidth, computedHeight);
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

  // ── RODAPÉ ──────────────────────────────────────────────────────────────────

  /** Constrói o bloco HTML para a imagem de rodapé */
  const buildFooterImageHtml = (src: string, width: number, height: number): string => {
    const heightAttr = height > 0 ? ` height="${height}"` : "";
    const heightStyle = height > 0 ? ` height:${height}px; max-height:${height}px; min-height:${height}px;` : "";
    return `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0;margin-top:8px;"><tbody><tr><td width="${width}" style="padding:0;vertical-align:top;width:${width}px;min-width:${width}px;max-width:${width}px;" valign="top"><img src="${src}" width="${width}"${heightAttr} alt="Rodapé" data-footer-image="true" style="display:block;border:0;outline:none;width:${width}px;max-width:${width}px;min-width:${width}px;${heightStyle}" /></td></tr></tbody></table>`;
  };

  /** Injeta / actualiza / remove a imagem de rodapé no HTML processado */
  const applyFooterImageToHtml = (
    html: string,
    src: string,
    width: number,
    height: number,
  ): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const existing = doc.querySelector('[data-footer-image="true"]');

    // Se a imagem já existe e estamos apenas a redimensionar (mesmo src), actualiza in-place
    if (existing && src && existing.getAttribute("src") === src) {
      existing.setAttribute("width", String(width));
      (existing as HTMLElement).style.width = `${width}px`;
      (existing as HTMLElement).style.maxWidth = `${width}px`;
      if (height > 0) {
        existing.setAttribute("height", String(height));
        (existing as HTMLElement).style.height = `${height}px`;
      } else {
        existing.removeAttribute("height");
        (existing as HTMLElement).style.height = "";
      }
      return doc.body.innerHTML;
    }

    // Remove qualquer rodapé já existente (src diferente ou remoção)
    if (existing) {
      let footerTable: Element | null = existing;
      while (footerTable && footerTable.tagName !== "TABLE") {
        footerTable = footerTable.parentElement;
      }
      if (footerTable) {
        // Verifica se a tabela está dentro de um <tr> injectado
        const parentTr = footerTable.closest("tr");
        if (parentTr) {
          const trImages = parentTr.querySelectorAll("img");
          const trText = parentTr.textContent?.trim() || "";
          const onlyHasFooterImage =
            trImages.length === 1 &&
            trImages[0].getAttribute("data-footer-image") === "true" &&
            trText === "";
          if (onlyHasFooterImage) {
            parentTr.remove();
          } else {
            footerTable.remove();
          }
        } else {
          footerTable.remove();
        }
      }
    }

    if (!src) return doc.body.innerHTML;

    // Adiciona o novo rodapé antes do disclaimer (se existir), caso contrário no final
    const footerHtml = buildFooterImageHtml(src, width, height);
    const disclaimerBlock = doc.querySelector('[data-disclaimer-block="true"]');
    if (disclaimerBlock) {
      disclaimerBlock.insertAdjacentHTML("beforebegin", footerHtml);
    } else {
      doc.body.insertAdjacentHTML("beforeend", footerHtml);
    }

    return doc.body.innerHTML;
  };

  /** Atualiza apenas as dimensões da imagem de rodapé sem a mover no DOM */
  const updateFooterImageSize = (width: number, height: number) => {
    if (!footerImageSrc) return;

    // Protege contra o useEffect([processedHtml]) sobrescrever o DOM
    // enquanto sincronizamos o estado com as novas dimensões
    setUserEditing(true);

    // Se a imagem já existe no preview, actualiza apenas os atributos sem re-inserir
    if (previewRef.current) {
      const existingImg = previewRef.current.querySelector<HTMLImageElement>('[data-footer-image="true"]');
      if (existingImg) {
        existingImg.setAttribute("width", String(width));
        existingImg.style.width = `${width}px`;
        existingImg.style.maxWidth = `${width}px`;
        if (height > 0) {
          existingImg.setAttribute("height", String(height));
          existingImg.style.height = `${height}px`;
        } else {
          existingImg.removeAttribute("height");
          existingImg.style.height = "";
        }
        // Sincroniza o processedHtml com o novo innerHTML (inclui edições manuais do user)
        setProcessedHtml(previewRef.current.innerHTML);
        // Liberta a flag após React processar o setState
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setUserEditing(false);
          });
        });
        return;
      }
    }

    // Fallback: imagem ainda não existe no preview – usa o caminho normal
    // Lê sempre do DOM vivo (source of truth) para preservar edições manuais
    const currentHtml = previewRef.current
      ? previewRef.current.innerHTML
      : processedHtml;
    const newHtml = applyFooterImageToHtml(currentHtml, footerImageSrc, width, height);
    setProcessedHtml(newHtml);
    if (previewRef.current) previewRef.current.innerHTML = newHtml;
    // Liberta a flag após React processar o setState
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setUserEditing(false);
      });
    });
  };

  /** Guarda a posição de cursor actual como índice de filho directo do preview — resistente a perda de foco */
  const saveCursorPosition = () => {
    if (!previewRef.current) return;
    // Método 1: usar a selecção actual do browser
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      if (previewRef.current.contains(range.commonAncestorContainer)) {
        savedCursorRange.current = range;
        // Calcular índice do filho directo
        let node: Node | null = range.endContainer;
        while (node && node.parentNode !== previewRef.current) {
          node = node.parentNode;
        }
        if (node && node.parentNode === previewRef.current) {
          savedInsertChildIndex.current = Array.from(previewRef.current.childNodes).indexOf(node as ChildNode);
        }
        return;
      }
    }
    // Método 2: usar o savedCursorRange já guardado
    const range = savedCursorRange.current;
    if (range && previewRef.current.contains(range.commonAncestorContainer)) {
      let node: Node | null = range.endContainer;
      while (node && node.parentNode !== previewRef.current) {
        node = node.parentNode;
      }
      if (node && node.parentNode === previewRef.current) {
        savedInsertChildIndex.current = Array.from(previewRef.current.childNodes).indexOf(node as ChildNode);
      }
    }
  };

  /**
   * Encontra o nó ancestral mais próximo do cursor que represente uma "linha" na
   * estrutura da assinatura — tipicamente um <tr>, ou um filho directo de <tbody>/<table>,
   * ou na pior hipótese um filho directo do preview.  Isto garante que a imagem de
   * rodapé é inserida na posição correcta **dentro** da tabela, e não sempre no final.
   */
  /**
   * Insere a imagem na posição exacta do cursor guardado (savedCursorRange).
   * Estratégia:
   *  1. Restaura o range no canvas e usa execCommand('insertHTML') — o mais fiável
   *     em contentEditable, respeita a posição exacta dentro de qualquer elemento.
   *  2. Fallback: insere via Range.insertNode() se execCommand não funcionar.
   *  3. Fallback final: append depois da última tabela raiz.
   */
  const insertFooterImageAtCursor = (src: string, width: number, height: number) => {
    const footerHtml = buildFooterImageHtml(src, width, height);

    // Protege contra o useEffect([processedHtml]) sobrescrever o DOM durante a inserção
    setUserEditing(true);

    if (!previewRef.current) {
      const newHtml = applyFooterImageToHtml(processedHtml, src, width, height);
      setProcessedHtml(newHtml);
      // Nota: handleFooterImageUpload chama finalizeUpload() após esta função regressar
      return;
    }

    const preview = previewRef.current;
    const range = savedCursorRange.current;

    // Método 1: execCommand('insertHTML') — respeita a posição exacta do cursor
    if (range && preview.contains(range.commonAncestorContainer)) {
      try {
        // Restaura o foco e o range no canvas
        preview.focus();
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        // execCommand insere no ponto exacto da selecção
        const success = document.execCommand("insertHTML", false, footerHtml);
        if (success) {
          setProcessedHtml(preview.innerHTML);
          // Nota: handleFooterImageUpload chama finalizeUpload() após esta função regressar
          return;
        }
      } catch (_) {
        // Continua para fallback
      }
    }

    // Método 2: Range.insertNode() — alternativa quando execCommand falha
    if (range && preview.contains(range.commonAncestorContainer)) {
      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = footerHtml;
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);

        range.collapse(false); // move para o fim da selecção
        range.insertNode(fragment);
        setProcessedHtml(preview.innerHTML);
        // Nota: handleFooterImageUpload chama finalizeUpload() após esta função regressar
        return;
      } catch (_) {
        // Continua para fallback final
      }
    }

    // Fallback final: depois da última tabela raiz do preview
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = footerHtml;
    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);

    const rootTables = Array.from(preview.children).filter(
      (el) => el.tagName === "TABLE",
    );
    const lastTable = rootTables[rootTables.length - 1] ?? null;
    if (lastTable) {
      preview.insertBefore(fragment, lastTable.nextSibling);
    } else {
      preview.appendChild(fragment);
    }
    setProcessedHtml(preview.innerHTML);
    // Nota: handleFooterImageUpload chama finalizeUpload() após esta função regressar
  };

  /** Trata o upload da imagem de rodapé */
  const handleFooterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // Cancelou o file dialog — limpa o flag
      isInsertingFooterRef.current = false;
      return;
    }

    // Cancela qualquer timer de sync pendente antes de iniciar a inserção
    if (syncStateTimerRef.current) {
      clearTimeout(syncStateTimerRef.current);
      syncStateTimerRef.current = null;
    }

    /** Força a libertação de todos os flags de edição e restaura o foco no canvas */
    const finalizeUpload = () => {
      isInsertingFooterRef.current = false;
      setUserEditing(false);
      // Dá tempo ao React para processar o setState antes de focar
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (previewRef.current) {
            previewRef.current.focus();
          }
        });
      });
    };

    compressImage(file, 800, 400, 0.82).then((src) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setFooterOriginalAspectRatio(ratio);
        const currentWidth = footerImageWidth || img.naturalWidth;
        setFooterImageSrc(src);
        setFooterImageWidth(currentWidth);
        setFooterImageHeight(0); // auto
        if (processedHtml) {
          const existingImg = previewRef.current?.querySelector('[data-footer-image="true"]');
          if (existingImg) {
            setUserEditing(true);
            existingImg.setAttribute("src", src);
            existingImg.setAttribute("width", String(currentWidth));
            (existingImg as HTMLElement).style.width = `${currentWidth}px`;
            (existingImg as HTMLElement).style.maxWidth = `${currentWidth}px`;
            (existingImg as HTMLElement).style.height = "";
            existingImg.removeAttribute("height");
            if (previewRef.current) setProcessedHtml(previewRef.current.innerHTML);
          } else {
            insertFooterImageAtCursor(src, currentWidth, 0);
          }
        }
        // Liberta todos os flags após inserção completa
        finalizeUpload();
      };
      img.onerror = () => {
        finalizeUpload();
      };
      img.src = src;
    }).catch(() => {
      finalizeUpload();
    });
    e.target.value = "";
  };

  /** Remove a imagem de rodapé */
  const removeFooterImage = () => {
    setFooterImageSrc("");
    setFooterImageWidth(400);
    setFooterImageHeight(0);
    // Remove directly from live DOM (source of truth) to avoid stale state issues
    if (previewRef.current) {
      const existing = previewRef.current.querySelector('[data-footer-image="true"]');
      if (existing) {
        // Walk up to find the wrapper table for this footer image
        let footerTable: Element | null = existing;
        while (footerTable && footerTable.tagName !== "TABLE") {
          footerTable = footerTable.parentElement;
        }

        if (footerTable) {
          // Caso 1: A tabela do footer é filha directa do preview (inserção antiga/fallback)
          if (footerTable.parentElement === previewRef.current) {
            footerTable.remove();
          }
          // Caso 2: A tabela do footer está dentro de um <td> de um <tr> injectado na tabela principal
          else {
            // Procura o <tr> que contém esta tabela de footer
            let tr: Element | null = footerTable;
            while (tr && tr.tagName !== "TR") {
              tr = tr.parentElement;
            }
            if (tr) {
              // Verifica se este <tr> contém APENAS o footer image (não tem outro conteúdo da assinatura)
              const trImages = tr.querySelectorAll("img");
              const trText = tr.textContent?.trim() || "";
              const onlyHasFooterImage =
                trImages.length === 1 &&
                trImages[0].getAttribute("data-footer-image") === "true" &&
                trText === "";
              if (onlyHasFooterImage) {
                // O <tr> foi injectado por nós — remove-o
                tr.remove();
              } else {
                // O <tr> tem outro conteúdo — remove apenas a tabela do footer
                footerTable.remove();
              }
            } else {
              // Fallback: remove apenas a tabela do footer
              footerTable.remove();
            }
          }
        }
      }
      setUserEditing(true);
      setProcessedHtml(previewRef.current.innerHTML);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUserEditing(false);
        });
      });
    } else if (processedHtml) {
      const newHtml = applyFooterImageToHtml(processedHtml, "", 0, 0);
      setUserEditing(true);
      setProcessedHtml(newHtml);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUserEditing(false);
        });
      });
    }
  };

  const handleFooterWidthChange = (newWidth: number) => {
    setFooterImageWidth(newWidth);
    setFooterImageHeight(0);
    updateFooterImageSize(newWidth, 0);
  };

  const handleFooterHeightChange = (newHeight: number) => {
    setFooterImageHeight(newHeight);
    if (footerAspectRatioLocked && footerOriginalAspectRatio > 0) {
      const newWidth = Math.round(newHeight * footerOriginalAspectRatio);
      setFooterImageWidth(newWidth);
      updateFooterImageSize(newWidth, newHeight);
    } else {
      updateFooterImageSize(footerImageWidth, newHeight);
    }
  };

  // ── DISCLAIMER ────────────────────────────────────────────────────────────────

  /** Atualiza o disclaimer no preview em tempo real */
  const handleDisclaimerChange = (text: string) => {
    setDisclaimerText(text);
    // Protege contra o useEffect([processedHtml]) sobrescrever o DOM
    setUserEditing(true);
    // Usa o innerHTML actual do DOM do preview (fonte de verdade) em vez do estado React
    // que pode estar desactualizado após edições directas ao DOM (e.g. imagem de rodapé)
    const currentHtml = previewRef.current
      ? previewRef.current.innerHTML
      : processedHtml;
    if (!currentHtml) {
      setUserEditing(false);
      return;
    }
    const newHtml = applyDisclaimerToHtml(currentHtml, text);
    setProcessedHtml(newHtml);
    if (previewRef.current) previewRef.current.innerHTML = newHtml;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setUserEditing(false);
      });
    });
  };

  // ────────────────────────────────────────────────────────────────────────────

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

      // Garante width em AMBOS formatos (atributo + CSS)
      const width = imgElement.style.width || imgElement.getAttribute("width");

      if (width) {
        const widthValue = parseInt(width.toString().replace("px", ""));
        if (!isNaN(widthValue)) {
          imgElement.setAttribute("width", widthValue.toString());
          imgElement.style.width = `${widthValue}px`;
        }
      }

      // Para o LOGO: Estratégia especial — define TODAS as dimensões explicitamente
      if (isLogo) {
        const widthValue = parseInt(width.toString().replace("px", ""));
        if (!isNaN(widthValue) && widthValue > 0) {
          imgElement.setAttribute("width", widthValue.toString());
          imgElement.style.width = `${widthValue}px`;
          imgElement.style.maxWidth = `${widthValue}px`;
          imgElement.style.minWidth = `${widthValue}px`;

          // Calcula height a partir do atributo existente ou aspect ratio
          const existingHeight = imgElement.getAttribute("height");
          const existingHeightStyle = imgElement.style.height;
          let heightValue = 0;
          if (existingHeight && parseInt(existingHeight) > 0) {
            heightValue = parseInt(existingHeight);
          } else if (existingHeightStyle && parseInt(existingHeightStyle) > 0) {
            heightValue = parseInt(existingHeightStyle);
          }

          if (heightValue > 0) {
            imgElement.setAttribute("height", heightValue.toString());
            imgElement.style.height = `${heightValue}px`;
            imgElement.style.maxHeight = `${heightValue}px`;
            imgElement.style.minHeight = `${heightValue}px`;
          }
        }

        // Display block força o Gmail a respeitar as dimensões
        imgElement.style.display = "block";

        // Border e outline removem qualquer borda que possa afetar dimensões
        imgElement.style.border = "0";
        imgElement.style.outline = "none";

        // Garante que margin e padding não afetam o tamanho
        imgElement.style.margin = "0";
        imgElement.style.padding = "0";

        // Remove atributos que permitem redimensionamento
        imgElement.removeAttribute("data-gce-editing");
        imgElement.removeAttribute("contenteditable");

        // Atributos adicionais que alguns clientes de email respeitam
        imgElement.setAttribute("border", "0");

        // Aplica width fixo também na TD pai E na TABLE pai
        let parentTd = imgElement.parentElement;
        while (parentTd && parentTd.tagName !== "TD") {
          parentTd = parentTd.parentElement;
        }
        if (parentTd && !isNaN(parseInt(width.toString().replace("px", "")))) {
          const wv = parseInt(width.toString().replace("px", ""));
          (parentTd as HTMLElement).setAttribute("width", wv.toString());
          (parentTd as HTMLElement).style.width = `${wv}px`;
          (parentTd as HTMLElement).style.minWidth = `${wv}px`;
          (parentTd as HTMLElement).style.maxWidth = `${wv}px`;

          // Fixa também a <table> pai
          const parentTable = parentTd.closest("table");
          if (parentTable) {
            (parentTable as HTMLElement).setAttribute("width", wv.toString());
            (parentTable as HTMLElement).style.width = `${wv}px`;
            (parentTable as HTMLElement).style.maxWidth = `${wv}px`;
          }
        }
      } else {
        // Para TODAS as outras imagens (ícones sociais, imagens de conteúdo):
        // Aplica a mesma estratégia de fixar dimensões com atributo + CSS + min/max
        const wStr = imgElement.style.width || imgElement.getAttribute("width");
        const hStr = imgElement.style.height || imgElement.getAttribute("height");

        if (wStr) {
          const wv = parseInt(wStr.toString().replace("px", ""));
          if (!isNaN(wv) && wv > 0) {
            imgElement.setAttribute("width", wv.toString());
            imgElement.style.width = `${wv}px`;
            imgElement.style.maxWidth = `${wv}px`;
            imgElement.style.minWidth = `${wv}px`;

            // Fixa também a célula pai E a tabela pai para máxima compatibilidade
            let parentTdOther = imgElement.parentElement;
            while (parentTdOther && parentTdOther.tagName !== "TD") {
              parentTdOther = parentTdOther.parentElement;
            }
            if (parentTdOther) {
              (parentTdOther as HTMLElement).setAttribute("width", wv.toString());
              (parentTdOther as HTMLElement).style.width = `${wv}px`;
              (parentTdOther as HTMLElement).style.minWidth = `${wv}px`;
              (parentTdOther as HTMLElement).style.maxWidth = `${wv}px`;

              // Fixa também a <table> pai da <td>
              const parentTableOther = parentTdOther.closest("table");
              if (parentTableOther) {
                const existingTableWidth = parentTableOther.getAttribute("width");
                // Só restringe a tabela se não tiver largura já definida (maior que a imagem)
                if (!existingTableWidth || parseInt(existingTableWidth) <= wv) {
                  (parentTableOther as HTMLElement).setAttribute("width", wv.toString());
                  (parentTableOther as HTMLElement).style.width = `${wv}px`;
                  (parentTableOther as HTMLElement).style.maxWidth = `${wv}px`;
                }
              }
            }
          }
        }

        if (hStr) {
          const hv = parseInt(hStr.toString().replace("px", ""));
          if (!isNaN(hv) && hv > 0) {
            imgElement.setAttribute("height", hv.toString());
            imgElement.style.height = `${hv}px`;
            imgElement.style.maxHeight = `${hv}px`;
            imgElement.style.minHeight = `${hv}px`;
          }
        }

        imgElement.setAttribute("border", "0");
      }
      imgElement.style.removeProperty("object-fit");
      imgElement.style.removeProperty("object-position");
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

    // CRÍTICO: Preserva e normaliza tags <font> com cores para Gmail
    const fontElements = doc.querySelectorAll("font");
    fontElements.forEach((fontEl) => {
      const fontElement = fontEl as HTMLElement;
      const colorAttr = fontElement.getAttribute("color");
      const styleColor = fontElement.style.color;

      // Se tem color OU style.color, garante que AMBOS estão presentes
      if (colorAttr || styleColor) {
        const color = colorAttr || styleColor;
        fontElement.setAttribute("color", color);
        fontElement.style.color = color;
      }
    });

    return doc.body.innerHTML.trim();
  };

  const applyColorToSelection = () => {
    if (!previewRef.current || !textColor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setError("Por favor, selecione o texto que deseja colorir.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const range = selection.getRangeAt(0);

    // Verifica se a seleção está dentro do canvas editável (preview)
    if (!previewRef.current.contains(range.commonAncestorContainer)) {
      setError(
        "Por favor, selecione texto dentro do canvas editável (lado direito).",
      );
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

      // Atualiza o processedHtml com o conteúdo editado do preview
      if (previewRef.current) {
        setUserEditing(true);
        setProcessedHtml(previewRef.current.innerHTML);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setUserEditing(false);
          });
        });
      }
    } catch (error) {
      // Se falhar (seleção complexa), tenta abordagem alternativa
      try {
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);

        selection.removeAllRanges();

        // Atualiza o processedHtml com o conteúdo editado do preview
        if (previewRef.current) {
          setUserEditing(true);
          setProcessedHtml(previewRef.current.innerHTML);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setUserEditing(false);
            });
          });
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

      // Sincroniza o HTML processado e o state dos links com debounce
      // para não interromper a escrita no input
      setUserEditing(true);
      if (syncStateTimerRef.current) {
        clearTimeout(syncStateTimerRef.current);
      }
      syncStateTimerRef.current = setTimeout(() => {
        if (previewRef.current) {
          // Atualiza o state dos links sem re-render durante escrita
          setLinks((prevLinks) =>
            prevLinks.map((link) =>
              link.index === index ? { ...link, url: newUrl } : link,
            ),
          );
          setProcessedHtml(previewRef.current.innerHTML);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setUserEditing(false);
            });
          });
        }
      }, 600);
    }
  };

  const copyToClipboard = async () => {
    try {
      if (previewRef.current) {
        // Usa o conteúdo atual do preview (pode ter sido editado pelo user)
        let htmlToCopy = previewRef.current.innerHTML;

        // Otimiza para Gmail (garante width e height fixos no logo)
        htmlToCopy = optimizeForGmail(htmlToCopy);

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
      const currentSrc = img.getAttribute("src") || "";
      const isBase64 = currentSrc.startsWith("data:");

      return (
        <div key={imageId} className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0">
              <img
                src={currentSrc}
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
              <p className="text-xs mt-0.5 flex items-center gap-1">
                {isBase64 ? (() => {
                  const sizeKb = Math.round(currentSrc.length * 0.75 / 1024);
                  return (
                    <span className={`font-medium flex items-center gap-1 ${sizeKb > 50 ? "text-red-600" : "text-green-600"}`}>
                      <Check className="w-3 h-3" /> Base64 comprimida · {sizeKb} KB
                    </span>
                  );
                })() : (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> URL externa ✓
                  </span>
                )}
              </p>
            </div>
            <label className="flex-shrink-0 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(imageId, e)}
                className="hidden"
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                <Upload className="w-4 h-4" />
                Ficheiro
              </div>
            </label>
          </div>
          <Accordion type="single" collapsible className="pl-1">
            <AccordionItem value="url" className="border border-gray-200 rounded-md">
              <AccordionTrigger className="px-3 py-2 text-xs font-medium text-gray-600 hover:no-underline">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Usar URL externa {isBase64 ? "(recomendado para Gmail)" : ""}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <input
                  type="url"
                  key={imageId + "-url"}
                  defaultValue={isBase64 ? "" : currentSrc}
                  onBlur={(e) => handleImageUrlChange(imageId, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleImageUrlChange(imageId, (e.target as HTMLInputElement).value); }}
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Cole o link direto da imagem (Google Drive, Imgur, CDN, etc.)</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {!isLogo && (
            <div className="pl-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Link da rede social:
              </label>
              <input
                type="url"
                key={imageId + "-link"}
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

          {error && (
            <div className="fixed top-4 right-4 z-50 p-4 bg-red-50 border-2 border-red-300 rounded-lg shadow-xl flex items-start gap-3 max-w-md animate-in slide-in-from-top-5">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="fixed top-4 right-4 z-50 p-4 bg-green-50 border-2 border-green-300 rounded-lg shadow-xl flex items-start gap-3 max-w-md animate-in slide-in-from-top-5">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 text-sm font-medium">
                {successMessage}
              </p>
            </div>
          )}

          {/* Tabs de navegação */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
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
              <TabsTrigger
                value="info"
                className="flex items-center gap-2 text-base"
              >
                <Info className="w-4 h-4" />
                Informações e Dicas
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
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".html,.htm"
                      className="hidden"
                      onChange={handleBackupFileImport}
                    />
                    <button
                      onClick={() => backupFileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      title="Abrir ficheiro de backup HTML para editar"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Abrir Backup
                    </button>
                    <button
                      onClick={exportAllSignatures}
                      disabled={savedSignatures.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      title="Exportar backup HTML de todas as assinaturas"
                    >
                      <Download className="w-4 h-4" />
                      Exportar Assinatura(s)
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

                {/* Dialog de seleção de assinatura do backup */}
                {showBackupPickerDialog && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Selecionar Assinatura do Backup
                          </h3>
                          <p className="text-sm text-gray-500">
                            {backupSignatures.length} assinaturas encontradas — escolha uma para editar
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
                        {backupSignatures.map((sig, idx) => (
                          <button
                            key={idx}
                            onClick={() => loadBackupSignature(sig)}
                            className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 rounded-lg transition-all text-sm font-medium text-gray-800 flex items-center gap-3"
                          >
                            <Edit3 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            {sig.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShowBackupPickerDialog(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                            onClick={() => editSavedSignature(sig)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
                            title="Editar assinatura no editor"
                          >
                            <Edit3 className="w-4 h-4" />
                            Editar
                          </button>
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
              {/* Banner de edição de assinatura guardada */}
              {editingSignatureId && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium">
                  <Edit3 className="w-4 h-4 flex-shrink-0" />
                  <span>A editar assinatura guardada: <strong>{signatureName}</strong></span>
                  <button
                    onClick={() => {
                      setEditingSignatureId(null);
                      setSignatureName("");
                    }}
                    className="ml-auto text-xs underline hover:no-underline text-amber-700"
                  >
                    Cancelar edição
                  </button>
                </div>
              )}
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                {/* Coluna Esquerda - Input */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      HTML Original (Referência)
                    </label>
                    <p
                      className="text-gray-500 mb-3 flex items-center gap-1"
                      style={{ fontSize: "14px" }}
                    >
                      <Info className="w-3 h-3" />
                      Cole ou carregue sua assinatura aqui. Edite no canvas à
                      direita.
                    </p>

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
                      contentEditable={false}
                      className="relative w-full p-4 border-2 border-blue-300 rounded-lg bg-white shadow-inner overflow-auto"
                      style={{ outline: "none", height: "532px" }}
                      data-placeholder="HTML Original (apenas visualização)"
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
                              value={logoHeight > 0 ? logoHeight : (originalAspectRatio > 0 ? Math.round(logoWidth / originalAspectRatio) : "auto")}
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
                              ? "Selecione o texto no CANVAS EDITÁVEL (lado direito) e clique no botão acima para aplicar a cor"
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
                                key={`link-${link.index}`}
                                defaultValue={link.url}
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

                  {processedHtml && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Image className="w-5 h-5" />
                        Inserir Imagem no Cursor
                      </label>
                      <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-lg space-y-3">
                        {/* Instrução */}
                        <div className="text-orange-800 bg-orange-100 border border-orange-300 px-3 py-2 rounded-md flex items-start gap-2" style={{ fontSize: "13px" }}>
                          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600" />
                          <span>Clique no canvas onde quer inserir a imagem, <strong>depois</strong> clique no botão abaixo.</span>
                        </div>
                        {/* Upload */}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFooterImageUpload}
                          className="hidden"
                          id="footer-image-upload"
                        />
                        <div className="flex gap-2">
                          <button
                            onMouseDown={(e) => {
                              // Guarda o range ANTES de o canvas perder o foco
                              e.preventDefault();
                              saveCursorPosition();
                              // Sinaliza que vamos inserir imagem (bloqueia o onBlur sync)
                              isInsertingFooterRef.current = true;
                            }}
                            onClick={() => {
                              document
                                .getElementById("footer-image-upload")
                                ?.click();
                              // Se o user fechar o file dialog sem escolher ficheiro,
                              // liberta o flag quando a janela recuperar o foco
                              const releaseFlag = () => {
                                // Dá tempo ao onChange de disparar primeiro (se ficheiro foi escolhido)
                                setTimeout(() => {
                                  isInsertingFooterRef.current = false;
                                }, 500);
                                window.removeEventListener("focus", releaseFlag);
                              };
                              window.addEventListener("focus", releaseFlag, { once: true });
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium text-sm"
                          >
                            <Upload className="w-4 h-4" />
                            {footerImageSrc
                              ? "Substituir Imagem"
                              : "Inserir Imagem no Cursor"}
                          </button>
                          {footerImageSrc && (
                            <button
                              onClick={removeFooterImage}
                              className="px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                              title="Remover imagem de rodapé"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Preview miniatura */}
                        {footerImageSrc && (
                          <div className="flex items-center gap-3 bg-white/60 p-2 rounded-md">
                            <img
                              src={footerImageSrc}
                              alt="Rodapé preview"
                              style={{ maxWidth: 80, maxHeight: 40, objectFit: "contain" }}
                              className="rounded border border-orange-200"
                            />
                            <span className="text-xs text-orange-700 font-medium">
                              Imagem de rodapé carregada
                            </span>
                          </div>
                        )}

                        {/* Controlos de dimensões (só visível quando há imagem) */}
                        {footerImageSrc && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Largura (px)
                                </label>
                                <input
                                  type="number"
                                  value={footerImageWidth}
                                  onChange={(e) =>
                                    handleFooterWidthChange(
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  min="10"
                                  max="800"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                              </div>

                              <button
                                onClick={() =>
                                  setFooterAspectRatioLocked(
                                    !footerAspectRatioLocked,
                                  )
                                }
                                className={`mt-5 p-2 rounded-md transition-colors ${
                                  footerAspectRatioLocked
                                    ? "bg-orange-600 text-white hover:bg-orange-700"
                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                }`}
                                title={
                                  footerAspectRatioLocked
                                    ? "Proporção travada"
                                    : "Proporção livre"
                                }
                              >
                                {footerAspectRatioLocked ? (
                                  <Lock className="w-5 h-5" />
                                ) : (
                                  <Unlock className="w-5 h-5" />
                                )}
                              </button>

                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Altura (px)
                                </label>
                                {footerAspectRatioLocked ? (
                                  <input
                                    type="text"
                                    value="auto"
                                    readOnly
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    value={
                                      footerImageHeight === 0
                                        ? ""
                                        : footerImageHeight
                                    }
                                    onChange={(e) =>
                                      handleFooterHeightChange(
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    min="10"
                                    max="800"
                                    placeholder="auto"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                  />
                                )}
                              </div>
                            </div>

                            <div
                              className="text-orange-700 bg-white/50 p-2 rounded flex items-start gap-2"
                              style={{ fontSize: "14px" }}
                            >
                              <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong>Dica:</strong> Dimensões atuais:{" "}
                                {footerImageWidth} ×{" "}
                                {footerImageHeight === 0
                                  ? "auto"
                                  : footerImageHeight}
                                px
                              </div>
                            </div>
                          </div>
                        )}

                        {footerImageSrc && (
                          <div
                            className="text-orange-700 bg-white/50 p-2 rounded flex items-start gap-2"
                            style={{ fontSize: "14px" }}
                          >
                            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Dica:</strong> Para reposicionar a imagem,
                              remova-a e insira novamente com o cursor no local pretendido.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Disclaimer ── */}
                  {processedHtml && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Disclaimer / Aviso Legal
                      </label>
                      <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-200 rounded-lg space-y-3">
                        <textarea
                          value={disclaimerText}
                          onChange={(e) => handleDisclaimerChange(e.target.value)}
                          placeholder={"Este e-mail e os seus anexos são confidenciais e destinam-se exclusivamente ao(s) destinatário(s) indicado(s).\nSe recebeu esta mensagem por engano, por favor, notifique o remetente e elimine-a imediatamente."}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm font-mono resize-y"
                          style={{ fontFamily: "monospace", fontSize: "12px" }}
                        />
                        <div className="flex items-start gap-2 text-slate-600 bg-white/50 p-2 rounded" style={{ fontSize: "13px" }}>
                          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            O disclaimer aparecerá por baixo da assinatura com uma linha separadora, em texto pequeno cinzento. Compatível com Gmail.
                            {disclaimerText && (
                              <button
                                onClick={() => handleDisclaimerChange("")}
                                className="ml-2 text-red-500 hover:text-red-700 underline text-xs font-medium"
                              >
                                Remover disclaimer
                              </button>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita - Preview */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-green-600" />
                    Canvas Editável (Edite e Visualize Aqui)
                  </label>
                  <p
                    className="text-gray-500 mb-3 flex items-center gap-1"
                    style={{ fontSize: "14px" }}
                  >
                    <Info className="w-3 h-3" />
                    Clique para editar texto. Use os controles para aplicar
                    cores e ajustar o logo.
                  </p>

                  {/* Botão para guardar assinatura */}
                  {!showSaveDialog && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowSaveDialog(true)}
                        disabled={
                          !processedHtml || (!editingSignatureId && processedHtml === originalHtml)
                        }
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:bg-gray-300 transition-all shadow-md font-medium"
                      >
                        <Save className="w-5 h-5" />
                        {editingSignatureId ? "Atualizar Assinatura" : "Guardar Assinatura"}
                      </button>
                    </div>
                  )}

                  {/* Dialog para guardar assinatura */}
                  {processedHtml && showSaveDialog && (
                    <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3 mb-4">
                      <label className="block text-sm font-semibold text-gray-700">
                        {editingSignatureId ? "Nome da Assinatura (atualizar)" : "Nome da Assinatura"}
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
                          {editingSignatureId ? "Atualizar" : "Guardar"}
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveDialog(false);
                            if (!editingSignatureId) setSignatureName("");
                          }}
                          className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {processedHtml ? (
                    <div
                      ref={previewRef}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={() => {
                        if (previewRef.current) {
                          // Mantém a flag activa enquanto o user está a escrever
                          // (usa directamente o ref para não activar o safety timer de 2s)
                          isUserEditingRef.current = true;
                          // Regista o timestamp da última edição directa no canvas
                          lastDirectEditTimestampRef.current = Date.now();
                          // Cancela qualquer sync pendente
                          if (syncStateTimerRef.current) {
                            clearTimeout(syncStateTimerRef.current);
                          }
                          // Sincroniza o estado após 600ms de inactividade
                          // (só então permite que o useEffect volte a actualizar o DOM)
                          syncStateTimerRef.current = setTimeout(() => {
                            if (previewRef.current) {
                              const html = previewRef.current.innerHTML;
                              // Actualiza o estado sem re-renderizar o DOM (flag ainda true durante setProcessedHtml)
                              setProcessedHtml(html);
                              // Só liberta a flag depois de React ter processado o setState
                              requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                  isUserEditingRef.current = false;
                                });
                              });
                            }
                          }, 600);
                        }
                      }}
                      onBlur={() => {
                        // Não sincroniza se estiver a inserir imagem de rodapé
                        // (o file dialog causa blur antes da imagem ser inserida)
                        if (isInsertingFooterRef.current) return;
                        // Sincroniza imediatamente ao perder o foco
                        if (syncStateTimerRef.current) {
                          clearTimeout(syncStateTimerRef.current);
                          syncStateTimerRef.current = null;
                        }
                        if (previewRef.current) {
                          const html = previewRef.current.innerHTML;
                          setUserEditing(true);
                          setProcessedHtml(html);
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              setUserEditing(false);
                            });
                          });
                        }
                      }}
                      onMouseUp={(e) => {
                        // Usa caretRangeFromPoint para capturar a posição exacta do rato
                        const x = e.clientX;
                        const y = e.clientY;
                        let range: Range | null = null;
                        if ((document as any).caretRangeFromPoint) {
                          range = (document as any).caretRangeFromPoint(x, y);
                        } else if ((document as any).caretPositionFromPoint) {
                          const pos = (document as any).caretPositionFromPoint(x, y);
                          if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                          }
                        }
                        if (range && previewRef.current?.contains(range.commonAncestorContainer)) {
                          savedCursorRange.current = range;
                        } else {
                          const sel = window.getSelection();
                          if (sel && sel.rangeCount > 0) {
                            savedCursorRange.current = sel.getRangeAt(0).cloneRange();
                          }
                        }
                        // Guarda o índice de filho directo para uso futuro
                        if (savedCursorRange.current && previewRef.current) {
                          let node: Node | null = savedCursorRange.current.endContainer;
                          while (node && node.parentNode !== previewRef.current) {
                            node = node.parentNode;
                          }
                          if (node && node.parentNode === previewRef.current) {
                            savedInsertChildIndex.current = Array.from(previewRef.current.childNodes).indexOf(node as ChildNode);
                          }
                        }
                      }}
                      onClick={(e) => {
                        // Garante que os flags de edição estão limpos quando o user clica no canvas
                        // (protecção contra flags que ficaram presos após upload de imagem)
                        if (!isInsertingFooterRef.current) {
                          isUserEditingRef.current = false;
                          if (userEditingSafetyTimerRef.current) {
                            clearTimeout(userEditingSafetyTimerRef.current);
                            userEditingSafetyTimerRef.current = null;
                          }
                        }
                        // Usa caretRangeFromPoint para capturar a posição exacta do rato
                        const x = e.clientX;
                        const y = e.clientY;
                        let range: Range | null = null;
                        if ((document as any).caretRangeFromPoint) {
                          range = (document as any).caretRangeFromPoint(x, y);
                        } else if ((document as any).caretPositionFromPoint) {
                          const pos = (document as any).caretPositionFromPoint(x, y);
                          if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                          }
                        }
                        if (range && previewRef.current?.contains(range.commonAncestorContainer)) {
                          savedCursorRange.current = range;
                        } else {
                          const sel = window.getSelection();
                          if (sel && sel.rangeCount > 0) {
                            savedCursorRange.current = sel.getRangeAt(0).cloneRange();
                          }
                        }
                        // Guarda o índice de filho directo para uso futuro
                        if (savedCursorRange.current && previewRef.current) {
                          let node: Node | null = savedCursorRange.current.endContainer;
                          while (node && node.parentNode !== previewRef.current) {
                            node = node.parentNode;
                          }
                          if (node && node.parentNode === previewRef.current) {
                            savedInsertChildIndex.current = Array.from(previewRef.current.childNodes).indexOf(node as ChildNode);
                          }
                        }
                      }}
                      onKeyUp={() => {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                          savedCursorRange.current = sel.getRangeAt(0).cloneRange();
                          if (previewRef.current) {
                            let node: Node | null = savedCursorRange.current.endContainer;
                            while (node && node.parentNode !== previewRef.current) {
                              node = node.parentNode;
                            }
                            if (node && node.parentNode === previewRef.current) {
                              savedInsertChildIndex.current = Array.from(previewRef.current.childNodes).indexOf(node as ChildNode);
                            }
                          }
                        }
                      }}
                      onMouseMove={(e) => {
                        lastMousePos.current = { x: e.clientX, y: e.clientY };
                      }}
                      className="p-6 bg-white border-2 border-green-300 rounded-lg shadow-inner overflow-auto focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      style={{ height: "532px", outline: "none" }}
                    />
                  ) : (
                    <div
                      className="p-6 bg-white border-2 border-gray-300 rounded-lg shadow-inner overflow-auto"
                      style={{ height: "532px" }}
                    >
                      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                        <Image className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">
                          A aguardar assinatura
                        </p>
                        <p className="text-sm mt-2">
                          Carregue a sua assinatura, para a poder visualizar
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Informações e Dicas */}
            <TabsContent value="info" className="mt-0">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Lightbulb className="w-6 h-6 text-yellow-500" />
                  Informações e Dicas
                </h2>

                {/* Seção: IMPORTANTE - Como Copiar para Gmail */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    ⚠️ Importante: Como Copiar para o Gmail
                  </h3>
                  <div className="space-y-3 text-amber-800">
                    <p className="font-medium">
                      Para garantir que as cores e formatação aparecem
                      corretamente no Gmail:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 ml-2 bg-white bg-opacity-50 p-4 rounded-lg">
                      <li>
                        <strong>Guarde</strong> a assinatura usando o botão
                        "Guardar" (ele fica ativo após fazer alterações)
                      </li>
                      <li>
                        Vá à aba <strong>"Assinaturas Guardadas"</strong>
                      </li>
                      <li>
                        <strong>Copie</strong> a assinatura a partir da lista de
                        assinaturas guardadas
                      </li>
                      <li>
                        Cole no Gmail - as cores e formatação serão preservadas
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Seção: Como Usar */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Como Usar Esta Aplicação
                  </h3>
                  <ul className="space-y-2 text-blue-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Cole o HTML</strong> da sua assinatura na área
                        de entrada
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Faça upload do logo</strong> clicando no botão
                        "Alterar Imagem"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Faça upload dos logos</strong> e defina os links
                        de cada uma das suas redes sociais
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Edite os links e os textos</strong> dos links
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Ajuste as cores e espaçamentos</strong> usando
                        os controlos disponíveis
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Copie a assinatura</strong> usando o botão
                        "Copiar Assinatura"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Cole no Gmail</strong> nas configurações de
                        assinatura
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>
                        <strong>Guarde a sua assinatura</strong> para poder
                        reutilizá-la ou editá-la mais tarde
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Seção: Como Definir no Gmail */}
                <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Como Definir a Assinatura no Gmail
                  </h3>
                  <div className="space-y-3 text-indigo-800">
                    <p className="mb-3">
                      Depois de copiar a assinatura, siga estes passos:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>
                        <strong>Abra o Gmail</strong> no seu navegador
                      </li>
                      <li>
                        Clique no <strong>ícone de engrenagem</strong> (⚙️) no
                        canto superior direito
                      </li>
                      <li>
                        Selecione <strong>"Ver todas as configurações"</strong>
                      </li>
                      <li>
                        No separador <strong>"Geral"</strong>, desça até à
                        secção <strong>"Assinatura"</strong>
                      </li>
                      <li>
                        Clique em <strong>"Criar nova"</strong> ou selecione uma
                        assinatura existente
                      </li>
                      <li>
                        <strong>Cole a assinatura</strong> copiada (Ctrl+V ou
                        Cmd+V)
                      </li>
                      <li>
                        Desça até ao final da página e clique em{" "}
                        <strong>"Guardar alterações"</strong>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-indigo-100 rounded-md">
                      <p className="text-sm flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Dica:</strong> Pode definir se a assinatura
                          aparece em novos emails, respostas ou ambos.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seção: Logo da Marca */}
                <div className="bg-purple-50 border-l-4 border-purple-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Logo da Marca
                  </h3>
                  <div className="space-y-3 text-purple-800">
                    <p className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-purple-600" />
                      <span>
                        <strong>Dimensões do logo protegidas:</strong> O logo
                        mantém sempre as proporções corretas automaticamente.
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-purple-600" />
                      <span>
                        <strong>Tamanho no Gmail:</strong> O logo entra no Gmail
                        com o tamanho correto.
                      </span>
                    </p>
                  </div>
                </div>

                {/* Seção: Avisos Importantes */}
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Avisos Importantes
                  </h3>
                  <div className="space-y-3 text-yellow-800">
                    <p className="flex items-center gap-2">
                      <span className="text-2xl flex-shrink-0">⚠️</span>
                      <span>
                        <strong>
                          Não altere o tamanho do logo no editor do Gmail:
                        </strong>{" "}
                        O Gmail permite selecionar "Pequeno", "Médio", "Grande"
                        ou "Original". Mantenha sempre em{" "}
                        <strong>"Original"</strong> para preservar o tamanho
                        correto.
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-2xl flex-shrink-0">⚠️</span>
                      <span>
                        <strong>Se alterar por engano:</strong> Selecione o logo
                        no Gmail e escolha "Tamanho original" para voltar ao
                        correto.
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-2xl flex-shrink-0">💡</span>
                      <span>
                        <strong>Compatibilidade:</strong> A assinatura é
                        otimizada para Gmail, mas pode funcionar noutros
                        clientes de email.
                      </span>
                    </p>
                  </div>
                </div>

                {/* Seção: Dicas de Utilização */}
                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    Dicas de Utilização
                  </h3>
                  <ul className="space-y-2 text-green-800">
                    <li className="flex items-center gap-2">
                      <span className="text-xl flex-shrink-0">✅</span>
                      <span>
                        <strong>Guarde as suas assinaturas:</strong> Use o botão
                        "Guardar Assinatura" para não perder o seu trabalho.
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-xl flex-shrink-0">✅</span>
                      <span>
                        <strong>Teste antes de usar:</strong> Envie um email de
                        teste para si próprio para verificar a formatação.
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-xl flex-shrink-0">✅</span>
                      <span>
                        <strong>Espaçamento da barra:</strong> Ajuste o
                        espaçamento antes da barra vertical para melhor
                        alinhamento.
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-xl flex-shrink-0">✅</span>
                      <span>
                        <strong>Cores personalizadas:</strong> Use os seletores
                        de cor para combinar com a identidade visual da empresa.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Seção: Suporte */}
                <div className="bg-gray-50 border-l-4 border-gray-500 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Precisa de Ajuda?
                  </h3>
                  <p className="text-gray-700">
                    Se encontrar algum problema ou tiver dúvidas sobre a
                    utilização desta aplicação, entre em contacto com o suporte
                    técnico.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
