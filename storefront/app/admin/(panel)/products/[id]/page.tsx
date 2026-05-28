'use client';

import { useParams } from 'next/navigation';
import ProductForm from '../ProductForm';

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  return <ProductForm productId={id} />;
}
