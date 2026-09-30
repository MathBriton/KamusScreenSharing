export const pipSupported =
  typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

export function toggleFullscreen(el: HTMLElement | null) {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el?.requestFullscreen();
}

export async function togglePictureInPicture(video: HTMLVideoElement | null) {
  if (!pipSupported || !video) return;
  if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
  else await video.requestPictureInPicture();
}

/** Atalhos de teclado não disparam enquanto se digita no chat. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]');
}
