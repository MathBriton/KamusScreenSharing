interface NavigatorUAData {
  mobile?: boolean;
}

function isMobileDevice(): boolean {
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData };
  if (nav.userAgentData?.mobile) return true;
  // iPadOS se apresenta como Mac; o toque denuncia.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Navegadores de celular (Android e iOS) não permitem compartilhar a tela.
 * Nesses aparelhos o app só permite assistir.
 */
export const canShareScreen: boolean =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
  !isMobileDevice();
