import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import X from "lucide-react/dist/esm/icons/x";

export type MessageImage = {
  src: string;
  label: string;
};

function shouldUseTransientObjectUrl(src: string) {
  return src.toLowerCase().startsWith("data:image/");
}

function messageImageGridKey(image: MessageImage, index: number) {
  if (shouldUseTransientObjectUrl(image.src)) {
    return `${index}:${image.label}:${image.src.length}`;
  }
  return `${image.src}:${index}`;
}

function useTransientImageSrc(src: string) {
  const [transientSrc, setTransientSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldUseTransientObjectUrl(src)) {
      setTransientSrc(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(src)
      .then((response) => response.blob())
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setTransientSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setTransientSrc(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  return transientSrc ?? src;
}

const ManagedMessageImage = memo(function ManagedMessageImage({
  src,
  alt,
  loading,
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
}) {
  const renderSrc = useTransientImageSrc(src);
  return <img src={renderSrc} alt={alt} loading={loading} />;
});

export const MessageImageGrid = memo(function MessageImageGrid({
  images,
  onOpen,
  hasText,
}: {
  images: MessageImage[];
  onOpen: (index: number) => void;
  hasText: boolean;
}) {
  return (
    <div
      className={`message-image-grid${hasText ? " message-image-grid--with-text" : ""}`}
      role="list"
    >
      {images.map((image, index) => (
        <button
          key={messageImageGridKey(image, index)}
          type="button"
          className="message-image-thumb"
          onClick={() => onOpen(index)}
          aria-label={`Open image ${index + 1}`}
        >
          <ManagedMessageImage src={image.src} alt={image.label} loading="lazy" />
        </button>
      ))}
    </div>
  );
});

export const ImageLightbox = memo(function ImageLightbox({
  images,
  activeIndex,
  onClose,
}: {
  images: MessageImage[];
  activeIndex: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const activeImage = images[activeIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!activeImage) {
    return null;
  }

  return createPortal(
    <div
      className="message-image-lightbox"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="message-image-lightbox-content"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="message-image-lightbox-close"
          onClick={onClose}
          aria-label={t("messages.closeImagePreview")}
        >
          <X size={16} aria-hidden />
        </button>
        <ManagedMessageImage src={activeImage.src} alt={activeImage.label} />
      </div>
    </div>,
    document.body,
  );
});
