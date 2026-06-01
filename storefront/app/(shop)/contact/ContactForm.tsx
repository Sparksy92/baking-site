'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
        <p className="text-gray-600 mb-8 max-w-sm">Thank you for reaching out. We&apos;ll get back to you as soon as possible.</p>
        <button
          onClick={() => setStatus('idle')}
          className="px-6 py-3 bg-gray-100 text-gray-900 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  const inputClass = "w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">Name *</label>
          <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className={inputClass} placeholder="Jane Doe" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
          <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={inputClass} placeholder="you@example.com" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
          <select id="subject" name="subject" value={form.subject} onChange={handleChange} className={`${inputClass} appearance-none bg-white`}>
            <option value="">General Inquiry</option>
            <option value="Order Question">Order Question</option>
            <option value="Returns & Exchanges">Returns &amp; Exchanges</option>
            <option value="Product Question">Product Question</option>
            <option value="Shipping Question">Shipping Question</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="order_number" className="block text-sm font-semibold text-gray-700 mb-1.5">Order Number <span className="text-gray-400 font-normal">(optional)</span></label>
          <input id="order_number" name="order_number" type="text" value={form.order_number} onChange={handleChange} className={inputClass} placeholder="e.g. ELD-A3X7K9" />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
        <textarea id="message" name="message" required minLength={10} rows={5} value={form.message} onChange={handleChange} className={`${inputClass} resize-none`} placeholder="How can we help?" />
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-brand text-white px-8 py-4 rounded-xl text-base font-bold hover:bg-brand/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group shadow-lg shadow-brand/20"
      >
        {status === 'sending' ? (
          <><Loader2 className="animate-spin w-5 h-5" /> Sending...</>
        ) : (
          <>Send Message <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
        )}
      </button>
    </form>
  );
}
