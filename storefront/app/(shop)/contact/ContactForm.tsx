'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    order_number: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      await api.post('/api/contact', {
        name: form.name,
        email: form.email,
        subject: form.subject || 'General Inquiry',
        message: form.message,
        order_number: form.order_number || null,
      });
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', order_number: '', message: '' });
    } catch (err: unknown) {
      setStatus('error');
      const detail = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMsg(detail);
    }
  };

  if (status === 'sent') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <h3 className="text-lg font-semibold text-green-800 mb-2">Message Sent!</h3>
        <p className="text-green-700 text-sm">Thank you for reaching out. We&apos;ll get back to you within 24 hours.</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm text-brand hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select
            id="subject"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
          >
            <option value="">General Inquiry</option>
            <option value="Order Question">Order Question</option>
            <option value="Returns & Exchanges">Returns &amp; Exchanges</option>
            <option value="Product Question">Product Question</option>
            <option value="Shipping Question">Shipping Question</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="order_number" className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
          <input
            id="order_number"
            name="order_number"
            type="text"
            value={form.order_number}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="e.g. ELD-A3X7K9"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={5}
          value={form.message}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-y"
          placeholder="How can we help?"
        />
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full sm:w-auto bg-brand text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
