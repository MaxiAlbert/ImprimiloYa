
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  Printer, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  ChevronLeft, 
  Wand2, 
  FileText, 
  RefreshCcw,
  Trophy,
  PartyPopper,
  ExternalLink,
  Eye,
  X,
  Loader2,
  Download,
  AlertTriangle,
  Maximize2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import VisualGuide from './components/VisualGuide';
import { PrinterConfig, PrinterOutputMode, PaperOrientation, PDFData, PDFParts } from './types';

// Global PDF tools loaded via CDN in index.html
declare const PDFLib: any;
declare const pdfjsLib: any;

const App: React.FC = () => {
  const steps = ['Archivo', 'Ajustes', 'Impares', 'Girar', 'Pares'];
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isFinished, setIsFinished] = useState(false);
  const [pdfData, setPdfData] = useState<PDFData | null>(null);
  const [config, setConfig] = useState<PrinterConfig>({
    outputMode: PrinterOutputMode.FACE_DOWN,
    reinsertOrientation: PaperOrientation.ROTATED_180,
    flipSide: 'SHORT_EDGE'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [parts, setParts] = useState<PDFParts>({ odd: null, even: null });
  const [aiTip, setAiTip] = useState<string>("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>("");
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const checkLibs = setInterval(() => {
      if (typeof PDFLib !== 'undefined' && typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setLibsLoaded(true);
        clearInterval(checkLibs);
      }
    }, 100);
    return () => clearInterval(checkLibs);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setThumbnails([]);
    setGlobalError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      if (data[0] !== 0x25 || data[1] !== 0x50 || data[2] !== 0x44 || data[3] !== 0x46) {
        throw new Error("El archivo seleccionado no es un PDF válido.");
      }

      const pdfDoc = await PDFLib.PDFDocument.load(data.slice(0));
      const pagesCount = pdfDoc.getPageCount();

      setPdfData({
        name: file.name,
        size: file.size,
        pages: pagesCount,
        data: data.slice(0)
      });
      
      // Generate preview thumbnails (still using pdf.js for small previews)
      const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
      const pdf = await loadingTask.promise;
      const thumbs: string[] = [];
      const numPreviews = Math.min(pagesCount, 3);
      
      for (let i = 1; i <= numPreviews; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          thumbs.push(canvas.toDataURL());
        }
      }
      setThumbnails(thumbs);
      setStep(2);
      generateAITip(pagesCount);
    } catch (error: any) {
      console.error("Error loading PDF:", error);
      setGlobalError(error.message || "Error desconocido al procesar el PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAITip = async (pages: number) => {
    try {
      if (!process.env.API_KEY) return;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I have a PDF with ${pages} pages. Give me a 1-sentence energetic tip in Spanish for manual double-sided printing. Max 12 words.`,
      });
      setAiTip(response.text || "¡Ahorra papel e imprime con estilo!");
    } catch (e) {
      setAiTip("Imprime por ambos lados y salva un árbol hoy.");
    }
  };

  const processPDF = async () => {
    if (!pdfData) return;
    setIsProcessing(true);
    setGlobalError(null);

    try {
      const mainPdf = await PDFLib.PDFDocument.load(pdfData.data.slice(0));
      const oddPdf = await PDFLib.PDFDocument.create();
      const evenPdf = await PDFLib.PDFDocument.create();

      const pageCount = mainPdf.getPageCount();
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i);

      // Part 1: Odds
      const oddIndices = pageIndices.filter(i => (i + 1) % 2 !== 0);
      const copiedOdd = await oddPdf.copyPages(mainPdf, oddIndices);
      copiedOdd.forEach((p: any) => oddPdf.addPage(p));
      const oddBytes = await oddPdf.save();

      // Part 2: Evens (REVERSED for manual stack re-insertion)
      const evenIndices = pageIndices.filter(i => (i + 1) % 2 === 0);
      const reversedEvenIndices = [...evenIndices].reverse();
      
      const copiedEven = await evenPdf.copyPages(mainPdf, reversedEvenIndices);
      copiedEven.forEach((p: any) => evenPdf.addPage(p));
      const evenBytes = await evenPdf.save();

      setParts({ odd: oddBytes, even: evenBytes });
      setStep(3);
    } catch (err: any) {
      console.error("Processing Error:", err);
      setGlobalError("Error al dividir el PDF: " + (err.message || "Error desconocido"));
    } finally {
      setIsProcessing(false);
    }
  };

  const resetApp = () => {
    setStep(1);
    setIsFinished(false);
    setPdfData(null);
    setParts({ odd: null, even: null });
    setAiTip("");
    setThumbnails([]);
    setViewerUrl(null);
    setGlobalError(null);
  };

  const createPdfBlobUrl = (data: Uint8Array) => {
    const blob = new Blob([data], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  };

  const downloadFile = (data: Uint8Array, filename: string) => {
    const url = createPdfBlobUrl(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const PDFViewerModal = ({ url, title, onClose }: { url: string, title: string, onClose: () => void }) => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-5xl h-[92vh] rounded-[3rem] flex flex-col overflow-hidden shadow-2xl border border-white/20">
          <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <FileText className="text-blue-600 w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm sm:text-base truncate max-w-[180px] sm:max-w-md">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.open(url, '_blank')} 
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all uppercase"
              >
                <Maximize2 className="w-4 h-4" /> Expandir
              </button>
              <button onClick={onClose} className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-all hover:rotate-90">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-slate-100 relative">
            <iframe 
              src={`${url}#toolbar=1&navpanes=0&scrollbar=1`} 
              className="w-full h-full border-none"
              title="PDF Viewer"
            />
          </div>

          <div className="p-6 bg-white border-t border-slate-200 flex flex-wrap justify-center gap-4 shrink-0">
             <button 
                onClick={() => window.open(url, '_blank')} 
                className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase hover:bg-blue-50 px-8 py-3 rounded-2xl transition-all border-2 border-transparent hover:border-blue-100"
              >
               <ExternalLink className="w-4 h-4" /> Abrir en pestaña nueva
             </button>
             <button onClick={onClose} className="px-14 py-3 bg-slate-900 text-white text-xs font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl">
               Listo, volver
             </button>
          </div>
        </div>
      </div>
    );
  };

  const PDFPreviewCard = ({ data, title, pages }: { data: Uint8Array | null, title: string, pages: string }) => (
    <div 
      onClick={() => {
        if (data) {
          const url = createPdfBlobUrl(data);
          setViewerUrl(url);
          setViewerTitle(title);
        }
      }}
      className="group relative cursor-pointer mb-6 p-10 bg-white border-4 border-dashed border-slate-100 rounded-[3rem] hover:border-blue-400 hover:bg-blue-50/20 transition-all flex flex-col items-center justify-center text-center shadow-sm hover:shadow-2xl hover:-translate-y-2"
    >
      <div className="w-24 h-32 bg-white border-2 border-slate-100 rounded-xl shadow-sm group-hover:shadow-xl group-hover:border-blue-200 transition-all flex flex-col items-center justify-center mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-3 bg-blue-600"></div>
        <FileText className="w-10 h-10 text-blue-600" />
      </div>
      <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{title}</h4>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">{pages}</p>
      <div className="mt-8 flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-full font-black text-[12px] uppercase shadow-lg group-hover:scale-110 transition-transform">
        <Printer className="w-5 h-5" /> Ver e Imprimir
      </div>
      <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity italic">Recomendado: Usa el botón "Imprimir" del navegador</p>
    </div>
  );

  if (!libsLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-4 text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Iniciando motor PDF...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none z-0">
          {[...Array(40)].map((_, i) => (
            <div key={i} className="absolute w-3 h-3 rounded-sm animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 5}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
        </div>

        <div className="max-w-md w-full bg-white rounded-[4rem] shadow-2xl p-12 text-center border border-slate-100 relative z-10 animate-in zoom-in-90 duration-700">
          <div className="w-28 h-28 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <Trophy className="w-14 h-14" />
          </div>
          <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">¡LOGRADO!</h2>
          <p className="text-slate-500 font-medium mb-12 text-lg leading-tight">
            Gracias por elegir <span className="text-blue-600 font-black">IMPRIMILO YA!</span> Tu trabajo ha finalizado correctamente.
          </p>
          <button onClick={resetApp} className="w-full py-6 bg-slate-900 text-white font-black rounded-3xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 uppercase shadow-2xl shadow-slate-300 text-lg">
            <RefreshCcw className="w-6 h-6" /> Nuevo Trabajo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50">
      
      <div className="max-w-4xl w-full text-center mb-10">
        <h1 className="text-5xl sm:text-7xl font-black text-slate-900 tracking-tighter flex items-center justify-center gap-3">
          <Printer className="text-blue-600 w-12 h-12 sm:w-16 sm:h-16" />
          IMPRIMILO <span className="text-blue-600">YA!</span>
        </h1>
        <p className="mt-3 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
          Doble faz manual sin errores
        </p>
      </div>

      <div className="max-w-xl w-full mb-12 px-2">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-100 -translate-y-1/2 -z-0"></div>
          {steps.map((s, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black z-10 border-4 transition-all duration-500 ${
                step >= idx + 1 ? 'bg-blue-600 border-blue-100 text-white scale-110' : 'bg-white border-slate-100 text-slate-300'
              }`}>
                {idx + 1}
              </div>
              <span className={`mt-3 text-[9px] font-black uppercase tracking-widest ${step === idx + 1 ? 'text-blue-600' : 'text-slate-300'}`}>
                {s}
              </span>
              {idx < steps.length - 1 && (
                <div className={`absolute top-5 left-1/2 w-full h-[2px] transition-all duration-700 ${step > idx + 1 ? 'bg-blue-600' : 'bg-transparent'}`}></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {globalError && (
        <div className="max-w-4xl w-full mb-8 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2.5rem] flex items-center gap-4 text-red-800">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <div className="flex-1">
              <h4 className="font-black uppercase text-xs tracking-widest mb-1">¡UPS! ALGO SALIÓ MAL</h4>
              <p className="text-sm font-medium">{globalError}</p>
            </div>
            <button onClick={() => setGlobalError(null)} className="p-2 hover:bg-red-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl w-full bg-white rounded-[4rem] shadow-2xl shadow-slate-200/40 overflow-hidden border border-slate-100 mb-10">
        <div className="p-8 sm:p-14">
          
          {step === 1 && (
            <div className="text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="relative group cursor-pointer">
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
                <div className="mb-10 p-20 border-8 border-dotted border-slate-100 rounded-[3rem] group-hover:border-blue-400 group-hover:bg-blue-50/30 transition-all flex flex-col items-center">
                  <div className="w-28 h-28 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-200 group-hover:scale-110 transition-transform">
                    <FileUp className="w-12 h-12" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight">Elegir PDF</h3>
                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-3">Sube tu archivo para prepararlo</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 text-slate-400 bg-slate-50 py-4 px-8 rounded-2xl inline-flex mx-auto border border-slate-100">
                <Info className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black uppercase tracking-widest">Seguro • Privado • Local</span>
              </div>
            </div>
          )}

          {step === 2 && pdfData && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="mb-10 p-8 bg-slate-900 rounded-[2.5rem] text-white flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <FileText className="text-blue-400 w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg truncate max-w-[140px] sm:max-w-[280px]">{pdfData.name}</h4>
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">{pdfData.pages} Páginas Detectadas</p>
                  </div>
                </div>
                <button onClick={() => setStep(1)} className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black hover:bg-white/20 transition-all uppercase tracking-widest">Cambiar</button>
              </div>

              <div className="mb-10">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Confirmación Visual</h4>
                <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
                  {thumbnails.map((thumb, i) => (
                    <div key={i} className="flex-shrink-0 w-32 sm:w-40 bg-white border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm transition-all">
                      <img src={thumb} alt={`Pág ${i+1}`} className="w-full h-auto" />
                      <div className="p-3 text-center text-[10px] font-black text-slate-400 border-t border-slate-50 uppercase">Página {i+1}</div>
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tighter">¿Cómo salen las hojas de tu impresora?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button onClick={() => setConfig({...config, outputMode: PrinterOutputMode.FACE_UP})}
                  className={`p-8 rounded-[2rem] border-4 text-left transition-all group ${config.outputMode === PrinterOutputMode.FACE_UP ? 'border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-100' : 'border-slate-50 hover:border-slate-100'}`}>
                  <div className={`font-black text-xl mb-2 ${config.outputMode === PrinterOutputMode.FACE_UP ? 'text-blue-700' : 'text-slate-800'}`}>BOCA ARRIBA</div>
                  <p className="text-sm text-slate-500 font-medium italic">Se ve el contenido impreso al salir.</p>
                </button>
                <button onClick={() => setConfig({...config, outputMode: PrinterOutputMode.FACE_DOWN})}
                  className={`p-8 rounded-[2rem] border-4 text-left transition-all group ${config.outputMode === PrinterOutputMode.FACE_DOWN ? 'border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-100' : 'border-slate-50 hover:border-slate-100'}`}>
                  <div className={`font-black text-xl mb-2 ${config.outputMode === PrinterOutputMode.FACE_DOWN ? 'text-blue-700' : 'text-slate-800'}`}>BOCA ABAJO</div>
                  <p className="text-sm text-slate-500 font-medium italic">El contenido queda hacia abajo.</p>
                </button>
              </div>

              {aiTip && (
                <div className="mt-10 bg-amber-50 border-2 border-amber-100 p-6 rounded-[2.5rem] flex items-center gap-5 shadow-sm">
                  <div className="w-12 h-12 bg-amber-200 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Wand2 className="w-6 h-6" />
                  </div>
                  <p className="text-amber-900 text-sm font-bold leading-relaxed italic">"{aiTip}"</p>
                </div>
              )}

              <div className="mt-12 flex gap-6">
                <button onClick={() => setStep(1)} className="flex-1 px-8 py-6 bg-slate-100 text-slate-500 font-black rounded-3xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest border border-slate-200">Atrás</button>
                <button onClick={processPDF} className="flex-[2] py-6 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-4 text-xl uppercase tracking-tighter">
                  {isProcessing ? 'Procesando...' : 'Dividir PDF'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-10 duration-500">
              <h3 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Paso 1: Impares</h3>
              <p className="text-slate-500 font-medium mb-10 text-lg">Manda a imprimir este documento primero.</p>
              
              <PDFPreviewCard data={parts.odd} title="Paso 1: Lados Impares" pages="Páginas 1, 3, 5..." />

              <div className="flex flex-col sm:flex-row gap-6 mt-12">
                <button onClick={() => setStep(2)} className="flex-1 py-6 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest">Atrás</button>
                <button onClick={() => setStep(4)} className="flex-[2] py-6 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3 uppercase text-sm tracking-widest">Siguiente: Cómo girar <ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in zoom-in-95 duration-700">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Instrucciones de Giro</h3>
                <div className="bg-red-600 text-white px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-200 animate-pulse">Crítico</div>
              </div>
              
              <VisualGuide outputMode={config.outputMode} />

              <div className="mt-14 flex flex-col sm:flex-row gap-6">
                <button onClick={() => setStep(3)} className="flex-1 px-8 py-6 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest"><ChevronLeft className="w-5 h-5" /> Paso Anterior</button>
                <button onClick={() => setStep(5)} className="flex-[2] px-8 py-6 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-4 uppercase text-sm tracking-widest font-black">Ya giré las hojas <ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Paso Final: Pares</h3>
                <span className="bg-green-100 text-green-700 text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest">Orden Corregido</span>
              </div>
              <p className="text-slate-500 font-medium mb-10 text-lg">Carga las hojas giradas e imprime esto.</p>
              
              <PDFPreviewCard data={parts.even} title="Paso 2: Lados Pares" pages="Páginas 2, 4, 6... (Invertidas)" />

              <div className="flex flex-col sm:flex-row gap-6 mt-12">
                <button onClick={() => setStep(4)} className="flex-1 py-6 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest">Guía de Giro</button>
                <button onClick={() => setIsFinished(true)} className="flex-[2] py-6 bg-green-500 text-white font-black rounded-[3rem] hover:bg-green-600 shadow-2xl shadow-green-100 transition-all flex items-center justify-center gap-4 uppercase text-xl tracking-tighter"><PartyPopper className="w-7 h-7" /> Terminar Trabajo</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewerUrl && (
        <PDFViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      )}

    </div>
  );
};

export default App;
