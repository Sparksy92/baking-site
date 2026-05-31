'use client';

import { useState, useCallback } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Upload, X, Star, GripVertical } from 'lucide-react';
import { api, type ProductImage } from '@/lib/api';

interface Props {
  productId: string;
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
}

function SortableImage({ image, onDelete, onSetPrimary }: { image: ProductImage; onDelete: () => void; onSetPrimary: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group w-28 h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <img src={image.url} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
      <button type="button" {...attributes} {...listeners} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-white/90 rounded p-0.5 cursor-grab active:cursor-grabbing" title="Drag to reorder">
        <GripVertical size={14} className="text-gray-600" />
      </button>
      <button type="button" onClick={onSetPrimary} className={`absolute bottom-1 left-1 rounded p-0.5 ${image.is_primary ? 'bg-yellow-400 text-yellow-900' : 'opacity-0 group-hover:opacity-100 bg-white/90 text-gray-500 hover:text-yellow-600'}`} title={image.is_primary ? 'Primary image' : 'Set as primary'}>
        <Star size={14} fill={image.is_primary ? 'currentColor' : 'none'} />
      </button>
      <button type="button" onClick={onDelete} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center" title="Delete">
        <X size={12} />
      </button>
    </div>
  );
}

export default function SortableImageGallery({ productId, images, onImagesChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    const newImages: ProductImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const img = await api.upload<ProductImage>(`/api/admin/products/${productId}/images`, fd);
        newImages.push(img);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
    setUploading(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(images, oldIndex, newIndex);
    onImagesChange(reordered);

    // Persist sort order
    try {
      await api.patch(`/api/admin/products/${productId}/images`, {
        order: reordered.map((img, idx) => ({ id: img.id, sort_order: idx })),
      });
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/api/admin/products/${productId}/images/${id}`);
      onImagesChange(images.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  async function handleSetPrimary(id: number) {
    try {
      await api.patch(`/api/admin/products/${productId}/images/${id}`, { is_primary: true });
      onImagesChange(images.map((img) => ({ ...img, is_primary: img.id === id })));
    } catch (err) {
      console.error('Set primary failed:', err);
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {images.map((img) => (
              <SortableImage key={img.id} image={img} onDelete={() => handleDelete(img.id)} onSetPrimary={() => handleSetPrimary(img.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${dragOver ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'}`}
        onClick={() => document.getElementById('img-upload')?.click()}
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">
          {uploading ? 'Uploading...' : 'Drag & drop images here, or click to browse'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, WebP. First image is the primary.</p>
        <input id="img-upload" type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />
      </div>
    </div>
  );
}
