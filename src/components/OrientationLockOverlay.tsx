import React from 'react';
import { motion } from 'motion/react';
import { Smartphone, Tablet, RotateCw, Monitor } from 'lucide-react';
import { DeviceType } from '../utils/useDeviceOrientation';

interface Props {
  deviceType: DeviceType;
  expectedOrientation: 'portrait' | 'landscape';
}

export const OrientationLockOverlay: React.FC<Props> = ({ deviceType, expectedOrientation }) => {
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop';
  const isPhone = deviceType === 'phone';

  return (
    <div
      id="orientation-lock-overlay"
      className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center select-none"
    >
      <div className="max-w-md w-full bg-white/10 p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl flex flex-col items-center gap-5">
        
        {/* Animated Rotation Device Graphic */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <motion.div
            animate={{
              rotate: expectedOrientation === 'landscape' ? [0, 90, 90, 0] : [90, 0, 0, 90],
            }}
            transition={{
              repeat: Infinity,
              duration: 2.8,
              ease: 'easeInOut',
              times: [0, 0.4, 0.7, 1],
            }}
            className="w-20 h-20 rounded-2xl border-4 border-indigo-400 bg-indigo-500/20 flex items-center justify-center shadow-lg"
          >
            {isPhone ? (
              <Smartphone className="w-10 h-10 text-indigo-300" />
            ) : isTablet ? (
              <Tablet className="w-10 h-10 text-indigo-300" />
            ) : (
              <Monitor className="w-10 h-10 text-indigo-300" />
            )}
          </motion.div>

          {/* Rotating Circular Arrow */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <RotateCw className="w-26 h-26 text-pink-400/40" />
          </motion.div>
        </div>

        {/* Device pill badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-xs sm:text-sm font-bold text-indigo-200">
          {isPhone && <Smartphone className="w-4 h-4" />}
          {isTablet && <Tablet className="w-4 h-4" />}
          {isDesktop && <Monitor className="w-4 h-4" />}
          <span>
            {isPhone ? 'Smartphone detectado' : isTablet ? 'Tablet detectada' : 'Ordenador detectado'}
          </span>
        </div>

        {/* Text / Instructions */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {expectedOrientation === 'landscape'
              ? '¡Gira tu pantalla a horizontal!'
              : '¡Gira tu móvil a vertical!'}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
            {expectedOrientation === 'landscape' ? (
              <>
                En <strong>{isTablet ? 'tablets' : 'ordenadores'}</strong>, la aplicación está diseñada para
                utilizar <strong>todo el ancho de pantalla en horizontal</strong> y ofrecer la mejor experiencia visual y táctil.
              </>
            ) : (
              <>
                En <strong>smartphones</strong>, la aplicación está optimizada exclusivamente para su uso en
                <strong> modo vertical</strong>.
              </>
            )}
          </p>
        </div>

        {/* Hint banner */}
        <div className="w-full bg-white/5 py-2.5 px-4 rounded-xl border border-white/10 text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Esperando rotación del dispositivo...</span>
        </div>

      </div>
    </div>
  );
};
