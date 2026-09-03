import React, { useRef, useState, useEffect } from 'react';
import { Eraser, CheckCircle, PenTool, AlertCircle } from 'lucide-react';

interface SignaturePadProps {
  initialSignerName?: string;
  onSave: (signatureData: {
    signerName: string;
    signatureDataUrl: string;
    comments?: string;
  }) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  initialSignerName = '',
  onSave,
  onCancel,
  isSubmitting = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState(initialSignerName);
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Setup canvas resolution and styling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Save content if any
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx && canvas.width > 0) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#003875'; // TecniUrbano Deep Blue Ink
        ctx.lineWidth = 2.5;

        // Restore if had drawings
        if (tempCanvas.width > 0) {
          ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as MouseEvent).clientX - rect.left,
        y: (e as MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setError(null);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e.nativeEvent);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    setError(null);
  };

  // Exporta la firma a una resolución acotada para que el data URL sea pequeño.
  // El canvas de dibujo vive a (ancho × devicePixelRatio), que en pantallas retina
  // puede generar PNGs de cientos de KB si se exporta tal cual.
  const getSignatureDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    const MAX_WIDTH = 800;
    const MAX_HEIGHT = 300;
    const scale = Math.min(1, MAX_WIDTH / canvas.width, MAX_HEIGHT / canvas.height);
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));

    if (width === canvas.width && height === canvas.height) {
      return canvas.toDataURL('image/png');
    }

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    ctx.drawImage(canvas, 0, 0, width, height);
    return out.toDataURL('image/png');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) {
      setError('Por favor ingresá el nombre y apellido de quien firma.');
      return;
    }

    if (!hasDrawn || !canvasRef.current) {
      setError('Por favor realizá tu firma en el recuadro antes de confirmar.');
      return;
    }

    const dataUrl = getSignatureDataUrl();
    onSave({
      signerName: signerName.trim(),
      signatureDataUrl: dataUrl,
      comments: comments.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="signature-pad-form">
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <PenTool className="w-4 h-4 text-teal-600" />
            <span>Firma digital de conformidad del cliente</span>
          </div>
          <button
            type="button"
            onClick={clearSignature}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs hover:bg-rose-50 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Borrar firma
          </button>
        </div>

        {/* Canvas area */}
        <div className="relative bg-white dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-300 hover:border-teal-400 transition-colors h-44 sm:h-48 overflow-hidden touch-none cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full block"
          />

          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs gap-1 select-none">
              <PenTool className="w-6 h-6 stroke-1 text-slate-300 animate-bounce" />
              <span>Dibujá tu firma aquí con el dedo o mouse</span>
              <div className="w-48 h-px bg-slate-200 mt-2" />
              <span className="text-[10px] text-slate-400">Línea de firma</span>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nombre y apellido de quien firma *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => {
                setSignerName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ej: Florencia Soria"
              className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones del cliente (opcional)
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ej: Trabajo impecable y puntual"
              className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          {isSubmitting ? 'Guardando firma...' : 'Confirmar y Guardar Firma'}
        </button>
      </div>
    </form>
  );
};
