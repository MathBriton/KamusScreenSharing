import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  /** O que mostrar se a imagem não carregar (link quebrado, imagem expirada). */
  fallback?: ReactNode;
}

export function SafeImage({ fallback = null, onError, ...props }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      {...props}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}
