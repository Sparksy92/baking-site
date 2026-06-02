'use client';

import { useState, useEffect } from 'react';
import { addToast } from '@/lib/toast';

interface Review {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  customer_name: string;
  created_at: string;
}

interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  distribution: Record<string, number>;
}

export function ProductReviews({ productId }: { productId: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const res = await fetch(`/api/products/${productId}/reviews`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews);
          setSummary(data.summary);
        }
      } catch (e) {
        console.error('Failed to load reviews', e);
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title, body }),
      });
      if (res.ok) {
        addToast('Review submitted successfully. It will appear after approval.', 'success');
        setShowForm(false);
        setRating(5);
        setTitle('');
        setBody('');
      } else if (res.status === 401) {
        addToast('You must be logged in to submit a review.', 'error');
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to submit review', 'error');
      }
    } catch (e) {
      addToast('An error occurred.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function renderStars(ratingVal: number) {
    return (
      <div className="flex text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg key={star} className={`w-5 h-5 ${star <= ratingVal ? 'fill-current' : 'text-gray-200 fill-current'}`} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  }

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-50 rounded-xl mt-16"></div>;
  }

  return (
    <section className="mt-16 border-t border-gray-100 pt-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-medium text-brand hover:underline"
        >
          {showForm ? 'Cancel' : 'Write a Review'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-12 p-6 border border-gray-200 rounded-xl bg-gray-50">
          <h3 className="font-semibold text-lg mb-4">Write a Review</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`w-8 h-8 ${star <= rating ? 'text-amber-400' : 'text-gray-300'} hover:scale-110 transition-transform`}
                >
                  <svg className="w-full h-full fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-brand focus:border-brand"
              placeholder="Summarize your experience"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Review</label>
            <textarea
              required
              maxLength={2000}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-brand focus:border-brand"
              placeholder="Tell others what you thought about this product..."
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-brand text-white font-bold rounded-lg hover:bg-brand/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      )}

      {summary && summary.total_reviews > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="text-center md:text-left">
            <div className="text-5xl font-bold text-gray-900 mb-2">{summary.average_rating.toFixed(1)}</div>
            <div className="flex justify-center md:justify-start mb-2">
              {renderStars(Math.round(summary.average_rating))}
            </div>
            <div className="text-sm text-gray-500">Based on {summary.total_reviews} reviews</div>
          </div>
          <div className="col-span-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star.toString()] || 0;
              const percentage = (count / summary.total_reviews) * 100;
              return (
                <div key={star} className="flex items-center gap-4 mb-2 text-sm">
                  <div className="w-12 text-gray-600 flex items-center gap-1">
                    {star} <span className="text-amber-400">★</span>
                  </div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <div className="w-8 text-right text-gray-500">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !showForm && <p className="text-gray-500 italic mb-8">No reviews yet. Be the first to review this product!</p>
      )}

      <div className="space-y-8">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-gray-100 pb-8 last:border-0">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                {review.customer_name[0]}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{review.customer_name}</div>
                <div className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="mb-3">{renderStars(review.rating)}</div>
            {review.title && <h4 className="font-bold text-gray-900 mb-2">{review.title}</h4>}
            {review.body && <p className="text-gray-600 leading-relaxed text-sm">{review.body}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
