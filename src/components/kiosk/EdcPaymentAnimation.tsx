import Image from 'next/image';

interface EdcPaymentAnimationProps {
  className?: string;
  method?: 'CARD' | 'QRIS';
}

// Each method's pair of frames, cross-faded by the same keyframes below --
// the animation itself doesn't care about content, only the asset paths and
// alt text differ. Same 3D-icon illustration style, generated to match the
// existing card artwork (cream/mauve terminal, maroon-red accents).
const FRAMES = {
  CARD: {
    first: '/images/kiosk/edc-payment-tap.png',
    second: '/images/kiosk/edc-payment-insert.png',
    alt: 'Animasi kartu ditap lalu dimasukkan ke mesin EDC',
  },
  QRIS: {
    first: '/images/kiosk/edc-payment-qr-display.png',
    second: '/images/kiosk/edc-payment-qr-scan.png',
    alt: 'Animasi kode QR di layar mesin EDC dipindai dengan ponsel',
  },
} as const;

/**
 * Cross-fades between two locally generated raster illustrations.
 * The EDC artwork is kept outside the component so the animation stays cheap.
 */
export default function EdcPaymentAnimation({ className = '', method = 'CARD' }: EdcPaymentAnimationProps) {
  const frames = FRAMES[method];

  return (
    <div
      className={`relative aspect-square w-full max-w-[300px] overflow-hidden ${className}`.trim()}
      role="img"
      aria-label={frames.alt}
    >
      <div className="edc-payment-image edc-payment-image--tap" aria-hidden="true">
        <Image
          src={frames.first}
          alt=""
          fill
          priority
          draggable={false}
          sizes="(max-width: 640px) 280px, 300px"
          className="object-contain select-none"
        />
      </div>

      <div className="edc-payment-image edc-payment-image--insert" aria-hidden="true">
        <Image
          src={frames.second}
          alt=""
          fill
          priority
          draggable={false}
          sizes="(max-width: 640px) 280px, 300px"
          className="object-contain select-none"
        />
      </div>

      <style>{`
        .edc-payment-image {
          position: absolute;
          inset: 0;
          will-change: opacity, transform;
          animation-duration: 5s;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        .edc-payment-image--tap {
          transform-origin: 50% 62%;
          animation-name: edc-payment-tap-frame;
        }

        .edc-payment-image--insert {
          transform-origin: 50% 50%;
          animation-name: edc-payment-insert-frame;
        }

        @keyframes edc-payment-tap-frame {
          0%, 42% {
            opacity: 1;
            transform: translate(-1%, -2%) scale(0.93);
          }
          21% {
            opacity: 1;
            transform: translate(-1%, -3.5%) scale(0.93);
          }
          50%, 92% {
            opacity: 0;
            transform: translate(-3%, 0) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translate(-1%, -2%) scale(0.93);
          }
        }

        @keyframes edc-payment-insert-frame {
          0%, 42% {
            opacity: 0;
            transform: translate(0, 7%) scale(0.92);
          }
          50% {
            opacity: 1;
            transform: translate(0, 5%) scale(0.92);
          }
          66% {
            opacity: 1;
            transform: translate(0, 7%) scale(0.92);
          }
          84%, 92% {
            opacity: 1;
            transform: translate(0, 5%) scale(0.92);
          }
          100% {
            opacity: 0;
            transform: translate(0, 7%) scale(0.92);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .edc-payment-image {
            animation: none;
          }

          .edc-payment-image--tap {
            opacity: 1;
            transform: translate(-1%, -2%) scale(0.93);
          }

          .edc-payment-image--insert {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
