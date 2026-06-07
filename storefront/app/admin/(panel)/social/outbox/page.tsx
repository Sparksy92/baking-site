'use client';

import { Inbox } from 'lucide-react';

export default function OutboxPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Inbox size={20} className="text-brand" />
        <h1 className="text-2xl font-bold text-gray-900">Social Outbox</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Review and approve AI-generated social posts before they go live.
      </p>
      <div className="bg-white rounded-xl border border-gray-200 border-dashed p-16 text-center">
        <Inbox size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Outbox — Coming in Sprint 2</p>
        <p className="text-xs text-gray-400 mt-1">
          Once you publish a blog post, AI-generated social drafts will appear here for review and approval.
        </p>
      </div>
    </div>
  );
}
