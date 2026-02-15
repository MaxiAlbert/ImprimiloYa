
import React from 'react';
import { RefreshCw, ArrowRight, Printer, RotateCw } from 'lucide-react';
import { PrinterOutputMode, PaperOrientation } from '../types';

interface VisualGuideProps {
  outputMode: PrinterOutputMode;
}

const VisualGuide: React.FC<VisualGuideProps> = ({ outputMode }) => {
  const isFaceDown = outputMode === PrinterOutputMode.FACE_DOWN;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-8">
      <div className="flex flex-col lg:flex-row items-center gap-8 w-full justify-around">
        
        {/* Step 1: Output Stack */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-48 bg-slate-200 rounded-xl flex items-center justify-center border-2 border-slate-300">
             <div className="absolute top-2 text-[10px] font-bold text-slate-500 uppercase">Salida</div>
             {/* Stack of pages */}
             <div className="relative mt-4">
                <div className="absolute w-24 h-32 bg-white border border-slate-300 rounded shadow-sm transform translate-y-2 translate-x-2"></div>
                <div className="absolute w-24 h-32 bg-white border border-slate-300 rounded shadow-sm transform translate-y-1 translate-x-1"></div>
                <div className="w-24 h-32 bg-white border-2 border-blue-500 rounded shadow-md flex items-center justify-center relative">
                   <span className="text-2xl font-bold text-blue-500">1</span>
                   {isFaceDown && (
                     <div className="absolute inset-0 bg-slate-100/80 flex items-center justify-center rounded">
                        <span className="text-[10px] font-bold text-slate-400 rotate-45">TEXTO ABAJO</span>
                     </div>
                   )}
                </div>
             </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-600 uppercase tracking-tight">1. Retira el fajo</p>
        </div>

        <ArrowRight className="hidden lg:block w-6 h-6 text-slate-300" />

        {/* Step 2: The Flip Action */}
        <div className="flex flex-col items-center">
          <div className="w-40 h-48 flex items-center justify-center">
             <div className="relative group animate-pulse">
                <div className="w-24 h-32 bg-white border-2 border-amber-500 rounded shadow-xl flex items-center justify-center transform rotate-6 hover:rotate-0 transition-transform">
                   <RotateCw className="w-10 h-10 text-amber-500" />
                </div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-white px-2 py-1 rounded text-[10px] font-black uppercase">
                  Girar 180°
                </div>
             </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-600 uppercase tracking-tight">2. {isFaceDown ? 'Girar sin voltear' : 'Voltear y girar'}</p>
        </div>

        <ArrowRight className="hidden lg:block w-6 h-6 text-slate-300" />

        {/* Step 3: Input Tray */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-48 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-slate-700 overflow-hidden shadow-inner">
             <div className="absolute top-2 text-[10px] font-bold text-slate-500 uppercase">Bandeja de Entrada</div>
             <div className="w-24 h-32 bg-white border-2 border-green-500 rounded shadow-md flex items-center justify-center transform rotate-180">
                <span className="text-2xl font-bold text-green-500">2</span>
                <div className="absolute bottom-2 left-2 right-2 h-1 bg-green-100 rounded"></div>
             </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-600 uppercase tracking-tight">3. Reinsertar</p>
        </div>

      </div>

      <div className={`w-full p-5 rounded-2xl border-l-8 ${isFaceDown ? 'bg-amber-50 border-amber-400' : 'bg-blue-50 border-blue-400'}`}>
        <h4 className="font-bold text-sm mb-1 uppercase tracking-wider flex items-center gap-2">
          <Printer className="w-4 h-4" /> Instrucción Maestra
        </h4>
        <p className="text-sm leading-relaxed text-slate-700">
          {isFaceDown 
            ? "Tu impresora saca las hojas boca abajo. Toma el fajo como salió, gíralo 180 grados (lo que estaba arriba ahora entra primero) y ponlo de nuevo en la bandeja de entrada. NO lo voltees, solo gíralo sobre la mesa."
            : "Toma el fajo de hojas, dales la vuelta (boca abajo) y gíralas 180 grados para que el pie de página entre primero a la impresora."}
        </p>
        <p className="mt-2 text-[11px] font-bold text-red-600 italic uppercase">
          * Hemos invertido el orden de las páginas pares para que coincidan perfectamente con tu stack de papel.
        </p>
      </div>
    </div>
  );
};

export default VisualGuide;
