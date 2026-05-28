import { useEffect } from 'react';
import { brandName } from './format';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const brand = brandName();
    document.title = title ? `${title} | ${brand}` : brand;
  }, [title]);
}

export function setMetaTag(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export function setOGTag(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.content = content;
}
